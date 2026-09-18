/*
 * ==============================================================================
 * ALAGA HEALTHCARE SYSTEM — ESP32 Smart Moisture / Wetness Device
 * Device Role : Smart Diaper / Moisture Monitoring Device
 * Features    : 
 *   1. Captive Portal & Dynamic Wi-Fi Provisioning (No hardcoded Wi-Fi required)
 *   2. Non-Volatile Storage (Preferences / NVS) for Wi-Fi & Backend settings
 *   3. Battery Voltage & Percentage Monitoring (ADC on Pin 35)
 *   4. Digital / Analog Moisture Detection (Water Sensor on Pin 4)
 *   5. Seamless Web UI with Live Telemetry Dashboard & Network Configuration
 *   6. Automatic Backend HTTP POST Transmission (JSON payload)
 *   7. Hardware Factory Reset / AP Trigger via BOOT Button (GPIO 0)
 * ==============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// Disable brownout detector at the earliest possible stage (pre-main constructor)
void __attribute__((constructor(101))) disable_brownout() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
}

// ==============================================================================
// HARDWARE PIN DEFINITIONS & CALIBRATION
// ==============================================================================
const int WATER_PIN       = 4;   // Moisture sensor input (supports Analog ADC and Digital input)
const int BATTERY_PIN     = 35;  // Battery voltage ADC (GPIO 35 is ADC1, WiFi-safe)
const int CONFIG_BTN_PIN  = 0;   // ESP32 onboard BOOT button (Hold 3s to enter AP/Reset)

// Analog Moisture Sensor Calibration:
// Enables continuous intermediate readings (0% to 100%) rather than binary 0/100%
const int WETNESS_ADC_SAMPLES  = 16;   // Number of multi-samples to filter electrical noise
const int WETNESS_DRY_RAW      = 200;  // Baseline ADC reading when completely dry (0%)
const int WETNESS_WET_RAW      = 3200; // Saturated ADC reading when heavily wet (100%)
const bool INVERT_WETNESS_ADC  = false; // Set true if your sensor board pulls DOWN when wet

// ==============================================================================
// DEFAULT FACTORY SETTINGS (Saved in NVS; overridable via Captive Portal)
// ==============================================================================
const char* DEFAULT_AP_SSID    = "ALAGA-Moisture-Setup";
const char* DEFAULT_SERVER_URL = "https://alaga-backend.onrender.com/api/device/data";
const char* DEFAULT_DEVICE_ID  = "SD-2026-0001";

// ==============================================================================
// RUNTIME VARIABLES & STORAGE
// ==============================================================================
Preferences preferences;

String wifi_ssid       = "";
String wifi_password   = "";
String server_url      = DEFAULT_SERVER_URL;
String device_id       = DEFAULT_DEVICE_ID;

bool isAPMode          = false;
unsigned long lastSendTime = 0;
const long sendInterval    = 5000; // Send telemetry every 5 seconds

// Sensor & Battery Readings
int waterState         = 0;
int wetnessPercent     = 0;
int rawMoistureADC     = 0;
String wetnessLevel    = "DRY";
float batteryVoltage   = 0.0;
int batteryPercent     = 100;
int lastBackendCode    = 0;
bool isDevicePaired    = true;

// Web Server & DNS Server for Captive Portal
WebServer server(80);
DNSServer dnsServer;
const byte DNS_PORT = 53;
IPAddress apIP(192, 168, 4, 1);

// ==============================================================================
// BATTERY CALCULATION HELPER
// Standard 2x Resistor Divider (100k / 100k) on 3.7V - 4.2V LiPo/Li-ion cell
// ==============================================================================
void readBattery() {
  const int NUM_SAMPLES = 10;
  int rawAdc = 0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    rawAdc += analogRead(BATTERY_PIN);
    delay(2);
  }
  rawAdc /= NUM_SAMPLES;

  // ESP32 ADC: 0 - 4095 for 0 - 3.3V reference.
  // Resistor divider 1:1 doubles the measurable voltage range to 6.6V max.
  // 1.05 is an empirical calibration factor for ESP32 internal reference non-linearity.
  float pinVoltage = (rawAdc / 4095.0) * 3.3 * 1.05;
  batteryVoltage = pinVoltage * 2.0;

  // If running via USB without a battery connected (voltage reads < 2.0V or divider omitted),
  // default to 100% so monitoring systems don't falsely alert.
  if (batteryVoltage < 2.0) {
    batteryVoltage = 4.20;
    batteryPercent = 100;
    return;
  }

  // LiPo Discharge Curve Approximation (3.3V empty to 4.2V fully charged)
  if (batteryVoltage >= 4.20) {
    batteryPercent = 100;
  } else if (batteryVoltage >= 4.05) {
    batteryPercent = 85 + (int)((batteryVoltage - 4.05) / 0.15 * 15.0);
  } else if (batteryVoltage >= 3.85) {
    batteryPercent = 55 + (int)((batteryVoltage - 3.85) / 0.20 * 30.0);
  } else if (batteryVoltage >= 3.70) {
    batteryPercent = 25 + (int)((batteryVoltage - 3.70) / 0.15 * 30.0);
  } else if (batteryVoltage >= 3.40) {
    batteryPercent = 5 + (int)((batteryVoltage - 3.40) / 0.30 * 20.0);
  } else {
    batteryPercent = 0;
  }

  batteryPercent = constrain(batteryPercent, 0, 100);
}

// ==============================================================================
// CONTINUOUS ANALOG WETNESS IDENTIFIER FUNCTION
// Measures dynamic intermediate values between 0% and 100% instead of binary 0/1.
// Returns: 0 to 100 percentage.
// Categorization:
//   0% - 10%: DRY (Clean & dry surface)
//  11% - 35%: DAMP (Trace moisture / perspiration)
//  36% - 70%: MODERATE WETNESS (Urination detected - changing recommended soon)
//  71% - 100%: HEAVY WETNESS / SOAKED (Diaper saturated - immediate action required)
// ==============================================================================
int calculateWetnessPercentage() {
  // 1. Take multi-sampled ADC readings to filter high-frequency noise
  long rawSum = 0;
  for (int i = 0; i < WETNESS_ADC_SAMPLES; i++) {
    rawSum += analogRead(WATER_PIN);
    delay(2);
  }
  rawMoistureADC = (int)(rawSum / WETNESS_ADC_SAMPLES);

  int percent = 0;

  if (INVERT_WETNESS_ADC) {
    // Sensor voltage drops when wet (common on comparator analog pins)
    int clamped = constrain(rawMoistureADC, WETNESS_DRY_RAW, WETNESS_WET_RAW);
    percent = map(clamped, WETNESS_WET_RAW, WETNESS_DRY_RAW, 0, 100);
  } else {
    // Sensor voltage rises when wet (conductive tracks bridge to VCC)
    int clamped = constrain(rawMoistureADC, WETNESS_DRY_RAW, WETNESS_WET_RAW);
    percent = map(clamped, WETNESS_DRY_RAW, WETNESS_WET_RAW, 0, 100);
  }

  percent = constrain(percent, 0, 100);

  // 2. Intelligent Fallback:
  // If the user connects to a digital-only comparator board pin, check digitalRead:
  if (percent < 10 && digitalRead(WATER_PIN) == HIGH) {
    percent = 100;
  }

  return percent;
}

String getWetnessLevelDescription(int percent) {
  if (percent <= 10) return "DRY";
  if (percent <= 35) return "DAMP (Trace moisture)";
  if (percent <= 70) return "MODERATE WETNESS";
  return "HEAVY WETNESS (Saturated)";
}

// ==============================================================================
// SENSOR READING HELPER
// ==============================================================================
void readSensors() {
  wetnessPercent  = calculateWetnessPercentage();
  wetnessLevel    = getWetnessLevelDescription(wetnessPercent);
  waterState      = (wetnessPercent >= 35) ? HIGH : LOW;

  readBattery();
}

// ==============================================================================
// BACKEND DATA DISPATCH (JSON POST)
// ==============================================================================
void sendToBackend() {
  if (WiFi.status() == WL_CONNECTED && !isAPMode) {
    HTTPClient http;
    WiFiClientSecure client;

    if (server_url.startsWith("https://")) {
      client.setInsecure(); // Bypass CA check for Render cloud HTTPS
      http.begin(client, server_url);
    } else {
      http.begin(server_url);
    }

    http.addHeader("Content-Type", "application/json");
    http.setTimeout(10000); // 10s timeout for cloud TLS handshake

    // Determine Wi-Fi Signal Strength rating from RSSI
    int rssi = WiFi.RSSI();
    String signalStr = "Good";
    if (rssi >= -65) signalStr = "Excellent";
    else if (rssi >= -75) signalStr = "Good";
    else if (rssi >= -85) signalStr = "Fair";
    else signalStr = "Poor";

    // Payload formatted for Alaga /api/device/data & /api/sensor/reading
    String payload = "{"
      "\"device_id\":\"" + device_id + "\","
      "\"heart_rate\":0,"
      "\"temperature\":0,"
      "\"spo2\":0,"
      "\"moisture\":" + String(wetnessPercent) + ","
      "\"battery\":" + String(batteryPercent) + ","
      "\"signal\":\"" + signalStr + "\""
    "}";

    int httpCode = http.POST(payload);
    lastBackendCode = httpCode;

    if (httpCode == 200) {
      isDevicePaired = true;
    } else if (httpCode == 422) {
      isDevicePaired = false;
      Serial.println("⚠️ [UNPAIRED] Device is not assigned to any active patient in the database!");
    } else if (httpCode == 403) {
      isDevicePaired = false;
      Serial.println("⛔ [UNAUTHORIZED] Device serial is not registered or not active in the database!");
    }

    Serial.print("[HTTP] Telemetry POST payload: ");
    Serial.println(payload);
    Serial.print("[HTTP] Response Code: ");
    Serial.println(httpCode);

    http.end();
  } else {
    if (isAPMode) {
      Serial.println("ℹ️ [STATUS] In Setup Mode (AP: " + String(DEFAULT_AP_SSID) + "). Click to configure: http://192.168.4.1/setup");
    } else {
      Serial.println("⚠️ [STATUS] Wi-Fi not connected (Status: " + String(WiFi.status()) + "). Reconnecting...");
      WiFi.reconnect();
    }
  }
}

// ==============================================================================
// CAPTIVE PORTAL & WEB UI (HTML / CSS / JS)
// Modern, clinical design system matching the ALAGA Web Application
// ==============================================================================
String getHtmlHeader(String title) {
  String h = "<!DOCTYPE html><html lang='en'><head>";
  h += "<meta charset='UTF-8'>";
  h += "<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>";
  h += "<title>" + title + " — ALAGA</title>";
  // Prevent duplicate browser tabs from opening simultaneously on Windows
  h += "<script>";
  h += "try {";
  h += "  var lastOpen = localStorage.getItem('alaga_portal_opened');";
  h += "  var now = Date.now();";
  h += "  if (lastOpen && (now - Number(lastOpen)) < 3000 && !sessionStorage.getItem('alaga_primary_tab')) {";
  h += "    window.close();";
  h += "    document.addEventListener('DOMContentLoaded', function(){";
  h += "      document.body.innerHTML = '<div style=\"display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;color:#64748B;\"><p>Setup portal is already open in another tab.</p></div>';";
  h += "    });";
  h += "  } else {";
  h += "    localStorage.setItem('alaga_portal_opened', now);";
  h += "    sessionStorage.setItem('alaga_primary_tab', '1');";
  h += "  }";
  h += "} catch(e){}";
  h += "</script>";
  h += "<style>";
  h += ":root {";
  h += "  --primary: #4F46E5; --primary-hover: #4338CA; --bg: #F8FAFC; --card: #FFFFFF;";
  h += "  --text: #0F172A; --text-muted: #64748B; --border: #E2E8F0; --radius: 16px;";
  h += "  --emerald: #10B981; --amber: #F59E0B; --rose: #EF4444; --cyan: #06B6D4;";
  h += "}";
  h += "* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }";
  h += "body { background: linear-gradient(135deg, #EEF2F6 0%, #E0E7FF 100%); min-height: 100vh; padding: 20px 16px; color: var(--text); display: flex; justify-content: center; align-items: center; }";
  h += ".container { width: 100%; max-width: 480px; }";
  h += ".card { background: var(--card); border-radius: var(--radius); padding: 28px 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid var(--border); }";
  h += ".header { text-align: center; margin-bottom: 24px; }";
  h += ".logo-badge { display: inline-flex; align-items: center; gap: 8px; background: #EEF2FF; color: var(--primary); padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; }";
  h += ".title { font-size: 24px; font-weight: 800; color: #1E293B; }";
  h += ".subtitle { font-size: 14px; color: var(--text-muted); margin-top: 4px; }";
  h += ".stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }";
  h += ".stat-box { background: #F8FAFC; border: 1px solid var(--border); border-radius: 12px; padding: 14px; text-align: center; }";
  h += ".stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }";
  h += ".stat-value { font-size: 26px; font-weight: 800; color: #0F172A; }";
  h += ".stat-sub { font-size: 12px; font-weight: 600; margin-top: 4px; }";
  h += ".banner { border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center; }";
  h += ".banner-wet { background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; }";
  h += ".banner-moderate { background: #FFFBEB; border: 1px solid #FDE68A; color: #B45309; }";
  h += ".banner-damp { background: #ECFEFF; border: 1px solid #A5F3FC; color: #0E7490; }";
  h += ".banner-dry { background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; }";
  h += ".meter-bar { width: 100%; height: 10px; background: #E2E8F0; border-radius: 9999px; overflow: hidden; margin-top: 10px; }";
  h += ".meter-fill { height: 100%; border-radius: 9999px; transition: width 0.3s ease; }";
  h += ".form-group { margin-bottom: 16px; text-align: left; }";
  h += "label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; }";
  h += "input, select { width: 100%; padding: 12px 14px; border: 1.5px solid var(--border); border-radius: 10px; font-size: 14px; color: #1E293B; background: #FFF; transition: border-color 0.2s; outline: none; }";
  h += "input:focus, select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15); }";
  h += ".btn { display: block; width: 100%; padding: 14px; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.2s; text-align: center; text-decoration: none; }";
  h += ".btn-primary { background: var(--primary); color: #FFF; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25); }";
  h += ".btn-primary:hover { background: var(--primary-hover); }";
  h += ".btn-secondary { background: #F1F5F9; color: #475569; margin-top: 10px; }";
  h += ".btn-secondary:hover { background: #E2E8F0; }";
  h += ".info-list { margin-top: 20px; font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 16px; }";
  h += ".info-row { display: flex; justify-content: space-between; padding: 4px 0; }";
  h += ".badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; }";
  h += ".badge-success { background: #D1FAE5; color: #065F46; }";
  h += ".badge-warning { background: #FEF3C7; color: #92400E; }";
  h += "</style>";
  h += "</head><body><div class='container'>";
  return h;
}

String getHtmlFooter() {
  return "</div></body></html>";
}

// ------------------------------------------------------------------------------
// LIVE DASHBOARD (Station Mode or Manual Testing)
// ------------------------------------------------------------------------------
void handleDashboard() {
  readSensors();

  String page = getHtmlHeader("Moisture Monitor");
  page += "<div class='card'>";
  
  page += "<div class='header'>";
  page += "<div class='logo-badge'>💧 ALAGA SMART MONITOR</div>";
  page += "<h1 class='title'>Wetness Sensor</h1>";
  page += "<p class='subtitle'>Real-time patient moisture & power telemetry</p>";
  page += "</div>";

  // Large Status Banner Container (Supports intermediate 0-100% moisture tiers)
  String bannerClass = "banner banner-dry";
  String bannerEmoji = "☀️";
  String bannerTitle = "STATUS: DRY";
  String bannerDesc  = "Patient surface is clean and dry";
  String wetColor    = "#10B981";

  if (wetnessPercent > 70) {
    bannerClass = "banner banner-wet";
    bannerEmoji = "💧💧💧";
    bannerTitle = "HEAVY WETNESS / SOAKED";
    bannerDesc  = "Diaper saturated — immediate caregiver attention required";
    wetColor    = "#EF4444";
  } else if (wetnessPercent > 35) {
    bannerClass = "banner banner-moderate";
    bannerEmoji = "💧💧";
    bannerTitle = "MODERATE WETNESS";
    bannerDesc  = "Urination detected — changing pad / diaper recommended soon";
    wetColor    = "#F59E0B";
  } else if (wetnessPercent > 10) {
    bannerClass = "banner banner-damp";
    bannerEmoji = "💧";
    bannerTitle = "DAMP (TRACE MOISTURE)";
    bannerDesc  = "Minor moisture or perspiration detected";
    wetColor    = "#06B6D4";
  }

  page += "<div id='metric-banner' class='" + bannerClass + "'>";
  page += "<div id='banner-emoji' style='font-size: 32px;'>" + bannerEmoji + "</div>";
  page += "<div id='banner-title' style='font-size: 18px; font-weight: 800; margin-top: 4px;'>" + bannerTitle + "</div>";
  page += "<div id='banner-desc' style='font-size: 13px; opacity: 0.9;'>" + bannerDesc + "</div>";
  page += "</div>";

  // Dual Metric Cards: Moisture % and Battery %
  page += "<div class='stats-grid'>";
  
  // Moisture Box
  page += "<div class='stat-box'>";
  page += "<div class='stat-label'>Wetness Level</div>";
  page += "<div class='stat-value' id='metric-wetness' style='color: " + wetColor + ";'>" + String(wetnessPercent) + "<span style='font-size:16px;'>%</span></div>";
  page += "<div class='meter-bar'><div id='metric-wetness-bar' class='meter-fill' style='width: " + String(wetnessPercent) + "%; background: " + wetColor + ";'></div></div>";
  page += "<div class='stat-sub' id='metric-wetness-sub' style='color: " + wetColor + ";'>" + wetnessLevel + "</div>";
  page += "</div>";

  // Battery Box
  String batColor = batteryPercent > 50 ? "#10B981" : (batteryPercent > 20 ? "#F59E0B" : "#EF4444");
  page += "<div class='stat-box'>";
  page += "<div class='stat-label'>Battery Level</div>";
  page += "<div class='stat-value' id='metric-battery' style='color: " + batColor + ";'>" + String(batteryPercent) + "<span style='font-size:16px;'>%</span></div>";
  page += "<div class='meter-bar'><div id='metric-battery-bar' class='meter-fill' style='width: " + String(batteryPercent) + "%; background: " + batColor + ";'></div></div>";
  page += "<div class='stat-sub' id='metric-voltage' style='color: " + batColor + ";'>" + String(batteryVoltage, 2) + " V</div>";
  page += "</div>";
  
  page += "</div>"; // End stats-grid

  // Diagnostics & Network Info
  page += "<div class='info-list'>";
  page += "<div class='info-row'><span>Device Serial</span><span style='font-weight:700;'>" + device_id + "</span></div>";
  page += "<div class='info-row'><span>Wi-Fi Network</span><span>" + (isAPMode ? "Setup AP Mode" : WiFi.SSID()) + "</span></div>";
  page += "<div class='info-row'><span>Device IP</span><span>" + (isAPMode ? apIP.toString() : WiFi.localIP().toString()) + "</span></div>";
  page += "<div class='info-row'><span>Backend Status</span><span id='metric-backend'>";
  if (lastBackendCode == 200) {
    page += "<span class='badge badge-success'>Paired & Syncing (200 OK)</span>";
  } else if (lastBackendCode == 422) {
    page += "<span class='badge' style='background:#FEF3C7; color:#92400E;'>⚠️ Unpaired (No Patient)</span>";
  } else if (lastBackendCode == 403) {
    page += "<span class='badge' style='background:#FEE2E2; color:#991B1B;'>⛔ Unauthorized Device</span>";
  } else if (lastBackendCode > 0) {
    page += "<span class='badge badge-warning'>HTTP " + String(lastBackendCode) + "</span>";
  } else {
    page += "<span class='badge badge-warning'>" + String(isAPMode ? "Setup Mode" : "Standby") + "</span>";
  }
  page += "</span></div>";
  page += "</div>";

  // Action Buttons (Never blocked by page reload!)
  page += "<div style='margin-top: 20px;'>";
  page += "<a href='/setup' class='btn btn-secondary'>⚙️ Wi-Fi & Device Settings</a>";
  page += "</div>";

  // Live AJAX updates without reloading the entire page
  page += "<script>";
  page += "function updateLiveTelemetry() {";
  page += "  fetch('/status')";
  page += "    .then(function(r){ return r.json(); })";
  page += "    .then(function(d){";
  page += "      var p = Number(d.wetness) || 0;";
  page += "      var wColor = '#10B981';";
  page += "      var bClass = 'banner banner-dry';";
  page += "      var bEmoji = '☀️';";
  page += "      var bTitle = 'STATUS: DRY';";
  page += "      var bDesc = 'Patient surface is clean and dry';";
  page += "      if (p > 70) {";
  page += "        wColor = '#EF4444';";
  page += "        bClass = 'banner banner-wet';";
  page += "        bEmoji = '💧💧💧';";
  page += "        bTitle = 'HEAVY WETNESS / SOAKED';";
  page += "        bDesc = 'Diaper saturated — immediate caregiver attention required';";
  page += "      } else if (p > 35) {";
  page += "        wColor = '#F59E0B';";
  page += "        bClass = 'banner banner-moderate';";
  page += "        bEmoji = '💧💧';";
  page += "        bTitle = 'MODERATE WETNESS';";
  page += "        bDesc = 'Urination detected — changing pad / diaper recommended soon';";
  page += "      } else if (p > 10) {";
  page += "        wColor = '#06B6D4';";
  page += "        bClass = 'banner banner-damp';";
  page += "        bEmoji = '💧';";
  page += "        bTitle = 'DAMP (TRACE MOISTURE)';";
  page += "        bDesc = 'Minor moisture or perspiration detected';";
  page += "      }";
  page += "      document.getElementById('metric-wetness').innerHTML = p + '<span style=\"font-size:16px;\">%</span>';";
  page += "      document.getElementById('metric-wetness').style.color = wColor;";
  page += "      document.getElementById('metric-wetness-bar').style.width = p + '%';";
  page += "      document.getElementById('metric-wetness-bar').style.background = wColor;";
  page += "      document.getElementById('metric-wetness-sub').innerText = d.wetState || (p > 35 ? 'WET' : 'DRY');";
  page += "      document.getElementById('metric-wetness-sub').style.color = wColor;";
  page += "      var bColor = d.battery > 50 ? '#10B981' : (d.battery > 20 ? '#F59E0B' : '#EF4444');";
  page += "      document.getElementById('metric-battery').innerHTML = d.battery + '<span style=\"font-size:16px;\">%</span>';";
  page += "      document.getElementById('metric-battery').style.color = bColor;";
  page += "      document.getElementById('metric-battery-bar').style.width = d.battery + '%';";
  page += "      document.getElementById('metric-battery-bar').style.background = bColor;";
  page += "      document.getElementById('metric-voltage').innerText = Number(d.voltage).toFixed(2) + ' V';";
  page += "      document.getElementById('metric-voltage').style.color = bColor;";
  page += "      var banner = document.getElementById('metric-banner');";
  page += "      banner.className = bClass;";
  page += "      document.getElementById('banner-emoji').innerText = bEmoji;";
  page += "      document.getElementById('banner-title').innerText = bTitle;";
  page += "      document.getElementById('banner-desc').innerText = bDesc;";
  page += "    })";
  page += "    .catch(function(err){});";
  page += "}";
  page += "setInterval(updateLiveTelemetry, 2500);";
  page += "</script>";

  page += "</div>"; // End card
  page += getHtmlFooter();

  server.send(200, "text/html", page);
}

// ------------------------------------------------------------------------------
// JSON TELEMETRY ENDPOINT (/status)
// ------------------------------------------------------------------------------
void handleStatus() {
  readSensors();

  String json = "{";
  json += "\"wetness\":" + String(wetnessPercent) + ",";
  json += "\"wetState\":\"" + wetnessLevel + "\",";
  json += "\"rawAdc\":" + String(rawMoistureADC) + ",";
  json += "\"battery\":" + String(batteryPercent) + ",";
  json += "\"voltage\":" + String(batteryVoltage, 2) + ",";
  json += "\"isAP\":" + String(isAPMode ? "true" : "false") + ",";
  json += "\"backendCode\":" + String(lastBackendCode) + ",";
  json += "\"isPaired\":" + String(isDevicePaired ? "true" : "false");
  json += "}";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

// ------------------------------------------------------------------------------
// ROOT URL ROUTER
// ------------------------------------------------------------------------------
void handleRoot() {
  if (isAPMode) {
    handleSetup();
  } else {
    handleDashboard();
  }
}

// ------------------------------------------------------------------------------
// CAPTIVE PORTAL SETUP PAGE (/setup or AP Fallback)
// ------------------------------------------------------------------------------
void handleSetup() {
  Serial.println("\n[HTTP] Client accessed Setup Portal (/setup)");
  readBattery();

  // Cache Wi-Fi scan results for 20 seconds to prevent slow blocking responses
  static unsigned long lastScanTime = 0;
  static int cachedScanCount = -1;

  if (cachedScanCount < 0 || millis() - lastScanTime > 20000 || server.hasArg("rescan")) {
    WiFi.scanDelete();
    cachedScanCount = WiFi.scanNetworks(false, false, false, 150);
    lastScanTime = millis();
  }
  int n = cachedScanCount;

  String page = getHtmlHeader("Wi-Fi Setup Portal");
  page += "<div class='card'>";
  
  page += "<div class='header'>";
  page += "<div class='logo-badge'>📶 PROVISIONING PORTAL</div>";
  page += "<h1 class='title'>Device Setup</h1>";
  page += "<p class='subtitle'>Configure wireless connectivity & target backend</p>";
  page += "</div>";

  // Battery preview in portal
  String batColor = batteryPercent > 50 ? "#10B981" : (batteryPercent > 20 ? "#F59E0B" : "#EF4444");
  page += "<div style='background: #F8FAFC; border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;'>";
  page += "<span style='font-size: 13px; font-weight: 600; color: #475569;'>🔋 Device Battery Health</span>";
  page += "<span style='font-size: 14px; font-weight: 800; color: " + batColor + ";'>" + String(batteryPercent) + "% (" + String(batteryVoltage, 2) + "V)</span>";
  page += "</div>";

  page += "<form method='POST' action='/save'>";
  
  // Wi-Fi SSID Dropdown with Detected Networks
  page += "<div class='form-group'>";
  page += "<div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;'>";
  page += "<label for='ssid' style='margin-bottom:0;'>Wi-Fi Network (SSID)</label>";
  page += "<a href='/setup?rescan=1' style='font-size:12px; color:var(--primary); text-decoration:none; font-weight:600;'>🔄 Rescan</a>";
  page += "</div>";

  if (n > 0) {
    page += "<select id='ssid' name='ssid' required onchange='checkCustomSSID(this)'>";
    page += "<option value=''>-- Select Available Network --</option>";
    for (int i = 0; i < n; ++i) {
      String netName = WiFi.SSID(i);
      int rssi = WiFi.RSSI(i);
      String selected = (netName == wifi_ssid) ? "selected" : "";
      page += "<option value='" + netName + "' " + selected + ">" + netName + " (" + String(rssi) + " dBm)</option>";
    }
    page += "<option value='__custom__'>+ Enter Hidden / Custom SSID</option>";
    page += "</select>";
    page += "<input type='text' id='custom_ssid' name='custom_ssid' placeholder='Enter Wi-Fi Network Name' style='display:none; margin-top: 8px;'>";
  } else {
    page += "<input type='text' id='ssid' name='ssid' value='" + wifi_ssid + "' placeholder='e.g. Hospital_Staff_2.4G' required>";
  }
  page += "</div>";

  // Wi-Fi Password with Show/Hide toggle
  page += "<div class='form-group'>";
  page += "<label for='password'>Wi-Fi Password</label>";
  if (wifi_password.length() > 0) {
    page += "<input type='password' id='password' name='password' minlength='8' placeholder='Enter password (or leave blank to keep saved)'>";
    page += "<p style='font-size:11px; color:var(--emerald); margin-top:4px;'>✓ Password saved (" + String(wifi_password.length()) + " chars). Leave blank to keep existing password.</p>";
  } else {
    page += "<input type='password' id='password' name='password' minlength='8' placeholder='Enter network password (min 8 characters)' required>";
  }
  page += "<div style='margin-top:6px; font-size:12px; display:flex; align-items:center; gap:6px;'>";
  page += "<input type='checkbox' id='show_pass' style='width:auto;' onclick='var p=document.getElementById(\"password\"); p.type=this.checked?\"text\":\"password\";'>";
  page += "<label for='show_pass' style='margin-bottom:0; cursor:pointer;'>Show Password</label>";
  page += "</div>";
  page += "</div>";

  // Backend Endpoint URL
  page += "<div class='form-group'>";
  page += "<label for='server_url'>Backend Ingestion URL</label>";
  page += "<input type='text' id='server_url' name='server_url' value='" + server_url + "' required>";
  page += "</div>";

  // Device Serial ID
  page += "<div class='form-group'>";
  page += "<label for='device_id'>Device Identity (Serial)</label>";
  page += "<input type='text' id='device_id' name='device_id' value='" + device_id + "' required>";
  page += "</div>";

  // Submit Button
  page += "<button type='submit' class='btn btn-primary'>Save Credentials & Connect</button>";
  page += "</form>";

  // Always provide a reliable button to view live sensor dashboard
  page += "<div style='margin-top: 10px;'>";
  if (!isAPMode) {
    page += "<a href='/' class='btn btn-secondary'>← Back to Live Dashboard</a>";
  } else {
    page += "<a href='/dashboard' class='btn btn-secondary'>📊 Test & View Live Sensor Readings</a>";
  }
  page += "</div>";

  page += "<div class='info-list'>";
  page += "<div class='info-row'><span>MAC Address</span><span style='font-family:monospace;'>" + WiFi.macAddress() + "</span></div>";
  page += "<div class='info-row'><span>Hardware Mode</span><span>" + String(isAPMode ? "Access Point (AP)" : "Station (STA)") + "</span></div>";
  if (wifi_ssid.length() > 0) {
    page += "<div class='info-row'><span>Configured SSID</span><span>" + wifi_ssid + "</span></div>";
  }
  page += "</div>";

  // Clear Wi-Fi Option
  if (wifi_ssid.length() > 0) {
    page += "<div style='margin-top: 16px; text-align: center;'>";
    page += "<a href='/reset' onclick='return confirm(\"Clear saved Wi-Fi credentials and return to Setup mode?\")' style='font-size: 12px; color: #EF4444; text-decoration: none; font-weight: 600;'>🗑️ Forget Saved Wi-Fi</a>";
    page += "</div>";
  }

  page += "<script>";
  page += "function checkCustomSSID(selectObj) {";
  page += "  var customInput = document.getElementById('custom_ssid');";
  page += "  if (selectObj.value === '__custom__') {";
  page += "    customInput.style.display = 'block';";
  page += "    customInput.required = true;";
  page += "  } else {";
  page += "    customInput.style.display = 'none';";
  page += "    customInput.required = false;";
  page += "  }";
  page += "}";
  page += "</script>";

  page += "</div>"; // End card
  page += getHtmlFooter();

  server.send(200, "text/html", page);
}

// ------------------------------------------------------------------------------
// SAVE SETTINGS HANDLER
// ------------------------------------------------------------------------------
void handleSave() {
  Serial.println("\n==================================================");
  Serial.println("[HTTP] Received Save Configuration Request (/save)");
  String new_ssid = server.arg("ssid");
  if (new_ssid == "__custom__" || new_ssid == "") {
    new_ssid = server.arg("custom_ssid");
  }
  new_ssid.trim();

  String new_pass    = server.arg("password");
  new_pass.trim();

  String new_url     = server.arg("server_url");
  new_url.trim();

  String new_dev_id  = server.arg("device_id");
  new_dev_id.trim();

  Serial.print("[HTTP] Received Target SSID: "); Serial.println(new_ssid);
  Serial.print("[HTTP] Password Provided    : "); Serial.println(new_pass.length() > 0 ? "YES (" + String(new_pass.length()) + " chars)" : "BLANK (Keep Saved)");

  if (new_pass.length() > 0 && new_pass.length() < 8) {
    Serial.println("⚠️ [HTTP WARNING] Password is only " + String(new_pass.length()) + " chars! WPA2 networks require at least 8 characters.");
  }

  if (new_ssid.length() == 0) {
    Serial.println("⚠️ [HTTP ERROR] Empty SSID submitted. Ignoring save.");
    server.send(400, "text/plain", "Error: Wi-Fi SSID cannot be empty.");
    return;
  }

  if (new_ssid.length() > 0) {
    // If same SSID and user left password blank, keep existing password
    if (new_ssid == wifi_ssid && new_pass.length() == 0 && wifi_password.length() > 0) {
      Serial.println("[NVS] Keeping previously saved password for SSID: " + wifi_ssid);
    } else {
      wifi_password = new_pass;
    }
    wifi_ssid = new_ssid;
  }
  if (new_url.length() > 0) {
    server_url = new_url;
  }
  if (new_dev_id.length() > 0) {
    device_id = new_dev_id;
  }

  // Persist to Flash NVS
  preferences.begin("alaga-cfg", false);
  preferences.putString("ssid", wifi_ssid);
  preferences.putString("pass", wifi_password);
  preferences.putString("url", server_url);
  preferences.putString("devid", device_id);
  preferences.end();

  Serial.println("[NVS] Credentials successfully saved to Flash.");
  Serial.print("[NVS] Target SSID: "); Serial.println(wifi_ssid);

  // Friendly Restart Confirmation Page
  String page = getHtmlHeader("Configuration Saved");
  page += "<div class='card' style='text-align:center;'>";
  page += "<div style='font-size:48px; margin-bottom: 12px;'>✅</div>";
  page += "<h1 class='title'>Settings Saved!</h1>";
  page += "<p class='subtitle' style='margin-top:8px;'>The ESP32 is rebooting to connect to <b>" + wifi_ssid + "</b>.</p>";
  page += "<div style='background:#F1F5F9; border-radius:12px; padding:14px; margin-top:16px; text-align:left; font-size:13px; line-height:1.5;'>";
  page += "<b>Next Steps:</b><br>";
  page += "1. Reconnect your computer or phone to <b>" + wifi_ssid + "</b>.<br>";
  page += "2. <i>Tip:</i> If Windows says <i>'Can\\'t connect to this network'</i>, simply toggle Wi-Fi <b>OFF</b> and <b>ON</b> in Windows, then connect.<br>";
  page += "3. Open your ALAGA web application to view live patient telemetry.";
  page += "</div>";
  page += "</div>";
  page += getHtmlFooter();

  server.send(200, "text/html", page);
  delay(2000);
  ESP.restart();
}

// ------------------------------------------------------------------------------
// FORGET WI-FI HELPER (Removes ONLY Wi-Fi; preserves Device ID & Backend settings)
// ------------------------------------------------------------------------------
void forgetWiFi() {
  preferences.begin("alaga-cfg", false);
  preferences.remove("ssid");
  preferences.remove("pass");
  preferences.end();

  // Wipe cached Wi-Fi credentials from ESP32 SDK internal flash
  WiFi.disconnect(true, true);

  wifi_ssid = "";
  wifi_password = "";

  Serial.println("[WIFI] Wi-Fi credentials erased. Device ID, Backend URL, and all logic preserved.");
}

// ------------------------------------------------------------------------------
// FACTORY / WI-FI RESET HANDLER
// ------------------------------------------------------------------------------
void handleReset() {
  forgetWiFi();

  String page = getHtmlHeader("Wi-Fi Reset");
  page += "<div class='card' style='text-align:center;'>";
  page += "<div style='font-size:48px; margin-bottom: 12px;'>📶</div>";
  page += "<h1 class='title'>Wi-Fi Cleared</h1>";
  page += "<p class='subtitle' style='margin-top:8px;'>Saved Wi-Fi credentials have been removed.</p>";
  page += "<p style='font-size:13px; color:var(--text-muted); margin-top:16px;'>Device ID (<b>" + device_id + "</b>) and sensor logic are safely preserved.<br>Rebooting into Captive Portal...</p>";
  page += "</div>";
  page += getHtmlFooter();

  server.send(200, "text/html", page);
  delay(1500);
  ESP.restart();
}

// ------------------------------------------------------------------------------
// CAPTIVE PORTAL PROBE HANDLERS (Stops multiple tabs from opening)
// ------------------------------------------------------------------------------
void handleCaptivePortalRedirect() {
  if (isAPMode) {
    String host = server.hostHeader();
    // Only redirect if client asked for an external domain (e.g. msftconnecttest.com)
    if (host.length() > 0 && host.indexOf("192.168.4.1") < 0) {
      server.sendHeader("Location", "http://192.168.4.1/setup", true);
      server.send(302, "text/plain", "");
      return;
    }
    handleSetup();
  } else {
    handleDashboard();
  }
}

void handleNotFound() {
  if (isAPMode) {
    String host = server.hostHeader();
    // If external domain probe, redirect once to setup
    if (host.length() > 0 && host.indexOf("192.168.4.1") < 0) {
      server.sendHeader("Location", "http://192.168.4.1/setup", true);
      server.send(302, "text/plain", "");
      return;
    }
  }
  // If requesting missing file (e.g. /favicon.ico) on 192.168.4.1, send 404 instead of looping setup
  server.send(404, "text/plain", "Not Found");
}

// ==============================================================================
// AP CAPTIVE PORTAL LAUNCHER
// ==============================================================================
void startAccessPointMode() {
  isAPMode = true;
  WiFi.disconnect(true);
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  WiFi.softAP(DEFAULT_AP_SSID);

  // Start DNS Server on port 53 to redirect all domain lookups to 192.168.4.1
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(DNS_PORT, "*", apIP);

  Serial.println("\n==================================================");
  Serial.println("[WIFI] Started Captive Portal Access Point");
  Serial.print("[WIFI] SSID       : "); Serial.println(DEFAULT_AP_SSID);
  Serial.print("[WIFI] IP Address : "); Serial.println(WiFi.softAPIP());
  Serial.println("[WIFI] Setup Link : http://192.168.4.1/setup");
  Serial.println("==================================================");
}

// ==============================================================================
// STATION MODE CONNECTION ROUTINE
// ==============================================================================
bool connectToWiFi() {
  if (wifi_ssid.length() == 0) {
    Serial.println("[WIFI] No saved SSID found in memory.");
    return false;
  }

  // Register Wi-Fi Event Listener for exact failure reason
  WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
    if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
      uint8_t reason = info.wifi_sta_disconnected.reason;
      Serial.print("\n[WIFI EVENT] Disconnect Reason Code: ");
      Serial.print(reason);
      if (reason == 2 || reason == 15 || reason == 202 || reason == 204) {
        Serial.println(" -> (AUTH_FAIL: Incorrect Wi-Fi Password!)");
      } else if (reason == 201) {
        Serial.println(" -> (NO_AP_FOUND: 2.4GHz network out of range or not broadcasting)");
      } else if (reason == 203) {
        Serial.println(" -> (ASSOC_FAIL: Router refused connection or max clients reached)");
      } else {
        Serial.println();
      }
    }
  });

  WiFi.disconnect(); // Disconnect cleanly without turning off radio PHY
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setTxPower(WIFI_POWER_15dBm); // Crucial for battery power: prevents high-current RF surge from tripping battery BMS / brownout

  Serial.println("==================================================");
  Serial.print("[WIFI] Target SSID      : "); Serial.println(wifi_ssid);
  Serial.print("[WIFI] Password Length  : "); Serial.println(wifi_password.length());

  if (wifi_password.length() == 0) {
    Serial.println("⚠️ [WIFI WARNING] Password is EMPTY! Secured networks require a password.");
    Serial.println("[WIFI] Switching to Setup Portal so you can enter the Wi-Fi password.");
    return false;
  }

  WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) { // 20 seconds timeout for fiber routers
    delay(500);
    Serial.print(".");
    attempts++;

    if (WiFi.status() == WL_CONNECT_FAILED) {
      Serial.println("\n[WIFI] Authentication failed! Check network password.");
      break;
    }
    if (WiFi.status() == WL_NO_SSID_AVAIL) {
      Serial.println("\n[WIFI] SSID not reachable! Ensure 2.4GHz network is active.");
      break;
    }
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] Connected successfully!");
    Serial.print("[WIFI] Assigned Local IP: ");
    Serial.println(WiFi.localIP());
    Serial.println("==================================================");
    isAPMode = false;
    return true;
  }

  Serial.print("[WIFI] Failed to connect. Status Code: ");
  Serial.println(WiFi.status());
  return false;
}

// ==============================================================================
// SETUP ROUTINE
// ==============================================================================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detector to prevent reboot loop on battery peak spikes
  setCpuFrequencyMhz(80);                     // 80MHz drops base active current draw by over 60% compared to 240MHz
  Serial.begin(115200);
  delay(500);

  Serial.println("\n\n==================================================");
  Serial.println("   ALAGA SMART MOISTURE MONITOR STARTING          ");
  Serial.println("==================================================");

  // 1. Initialize Hardware Pins
  analogSetAttenuation(ADC_11db); // Full 0 - 3.3V range on analog ADC channels
  pinMode(WATER_PIN, INPUT);
  pinMode(BATTERY_PIN, INPUT);
  pinMode(CONFIG_BTN_PIN, INPUT_PULLUP);

  // 2. Load Stored Configuration from Non-Volatile Storage (Preferences)
  preferences.begin("alaga-cfg", false);
  wifi_ssid     = preferences.getString("ssid", "");
  wifi_password = preferences.getString("pass", "");
  server_url    = preferences.getString("url", DEFAULT_SERVER_URL);
  device_id     = preferences.getString("devid", DEFAULT_DEVICE_ID);

  // Auto-migrate legacy local server IP to production Render cloud URL
  if (server_url.indexOf("192.168.254.") >= 0 || server_url.indexOf("localhost") >= 0) {
    Serial.println("[MIGRATION] Updating local server URL to Render Cloud: " + String(DEFAULT_SERVER_URL));
    server_url = DEFAULT_SERVER_URL;
    preferences.putString("url", DEFAULT_SERVER_URL);
  }
  preferences.end();

  Serial.print("[NVS] Loaded Device ID  : "); Serial.println(device_id);
  Serial.print("[NVS] Loaded Target SSID: "); Serial.println(wifi_ssid.length() > 0 ? wifi_ssid : "(None)");
  Serial.print("[NVS] Loaded Backend URL: "); Serial.println(server_url);

  // 3. Wi-Fi Connection Logic:
  // If credentials were saved via portal, connect to Wi-Fi and persist connection forever.
  // ONLY launch Captive Portal AP mode if NO credentials have ever been saved.
  if (wifi_ssid.length() > 0) {
    isAPMode = false;
    Serial.println("[WIFI] Saved credentials detected. Connecting to " + wifi_ssid + "...");
    connectToWiFi();
  } else {
    Serial.println("[WIFI] No saved Wi-Fi found. Starting Setup Portal...");
    startAccessPointMode();
  }

  // 5. Configure Web Server Routes
  server.on("/", handleRoot);
  server.on("/dashboard", handleDashboard);
  server.on("/setup", handleSetup);
  server.on("/status", handleStatus);
  server.on("/save", handleSave);
  server.on("/reset", handleReset);
  server.on("/favicon.ico", []() { server.send(204, "text/plain", ""); });
  server.on("/wpad.dat", []() { server.send(404, "text/plain", ""); });

  // Captive Portal Detection Endpoints (OS-level automatic popups)
  server.on("/generate_204", handleCaptivePortalRedirect);        // Android / Chrome
  server.on("/hotspot-detect.html", handleCaptivePortalRedirect); // iOS / Apple
  server.on("/canonical.html", handleCaptivePortalRedirect);
  server.on("/connecttest.txt", handleCaptivePortalRedirect);     // Windows NCSI (Triggers Action Needed)
  server.on("/ncsi.txt", handleCaptivePortalRedirect);
  server.on("/redirect", handleCaptivePortalRedirect);            // Windows Browser Redirect

  // Catch-all route for domain redirects in AP mode
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("[SERVER] Web Server active on port 80");
}

// ==============================================================================
// MAIN LOOP
// ==============================================================================
void loop() {
  // 1. Handle Captive Portal DNS Queries in AP Mode
  if (isAPMode) {
    dnsServer.processNextRequest();
  }

  // 2. Handle Inbound Web Client Requests
  server.handleClient();

  // 3. Factory Reset: Only if BOOT button is held for 10 full seconds while running (after 15s uptime)
  // This completely prevents accidental wipes during board flashing/bootloader resets!
  if (millis() > 15000 && digitalRead(CONFIG_BTN_PIN) == LOW) {
    unsigned long pressStart = millis();
    while (digitalRead(CONFIG_BTN_PIN) == LOW) {
      delay(50);
      if (millis() - pressStart > 10000) { // Held for 10 seconds
        Serial.println("\n[BOOT] BOOT button held for 10 seconds! Forgetting Wi-Fi and starting AP Setup Mode...");
        forgetWiFi();
        startAccessPointMode();
        break;
      }
    }
  }

  // 3b. Persistent Wi-Fi Keepalive: Never disconnect unless unpowered
  static unsigned long lastReconnectAttempt = 0;
  if (!isAPMode && wifi_ssid.length() > 0 && WiFi.status() != WL_CONNECTED) {
    if (millis() - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = millis();
      Serial.println("⚠️ [WIFI] Connection lost. Auto-reconnecting to " + wifi_ssid + "...");
      WiFi.disconnect();
      delay(50);
      WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());
    }
  }

  // 4. Periodic Reading & Dispatch
  if (millis() - lastSendTime >= sendInterval) {
    lastSendTime = millis();

    readSensors();

    // Print to Serial Monitor
    Serial.print("[MONITOR] Wetness: ");
    Serial.print(wetnessPercent);
    Serial.print("% (");
    Serial.print(wetnessLevel);
    Serial.print(", ADC=");
    Serial.print(rawMoistureADC);
    Serial.print(") | Battery: ");
    Serial.print(batteryPercent);
    Serial.print("% (");
    Serial.print(batteryVoltage, 2);
    Serial.println("V)");

    // Transmit to Backend if connected in Station mode
    sendToBackend();
  }

  delay(20);
}