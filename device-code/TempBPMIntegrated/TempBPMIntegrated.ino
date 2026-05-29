/*
 * ALAGA ESP32 #1 — Vital Signs Device
 * Sensors: MAX30102 (Heart Rate) + NTC Thermistor (Temperature)
 * Serial Monitor output only — no WiFi, no Flask
 */
#include <WiFi.h>
#include <HTTPClient.h> // Added: Library for backend communication
#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <math.h>

// WIFI Settings
//Change according to what wifi ur connected to
const char* ssid = "HG8145V5_CC22B";
const char* password = "2NcNx2tu";

// ==========================
// BACKEND SETTINGS
// ==========================
const char* serverURL = "http://192.168.254.113:3000/api/device/data"; // REPLACE WITH YOUR PC IP
const char* deviceID  = "VS-2026-0001"; // Registered identity

// ==========================
// TIMING
// ==========================
unsigned long lastSendTime = 0;
const long sendInterval = 5000;

// ==========================
// MAX30102
// ==========================
MAX30105 particleSensor;

long  lastBeat       = 0;
float beatsPerMinute = 0;
float beatAvg        = 0;
long  irValue        = 0;

// ==========================
// THERMISTOR (Pin 35)
// ==========================
const int   THERMISTOR_PIN      = 35;
const float SERIES_RESISTOR     = 10000.0;
const float NOMINAL_RESISTANCE  = 10000.0;
const float NOMINAL_TEMPERATURE = 25.0;
const float B_COEFFICIENT       = 3950.0;
const float TEMP_CALIBRATION    = 4.8;
float temperatureC = 0;

// ==========================
// SEND TO BACKEND
// ==========================
void sendToBackend() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");

    String payload = "{\"device_id\":\"" + String(deviceID) + 
                     "\",\"heart_rate\":" + String(beatAvg, 1) + 
                     ",\"temperature\":" + String(temperatureC, 1) + 
                     ",\"spo2\":97,\"moisture\":0}";

    int code = http.POST(payload);
    Serial.println("Backend Response Code: " + String(code));
    http.end();
  }
}

// ==========================
// SETUP
// ==========================
void setup() {
  Serial.begin(115200);
  Serial.println("ALAGA Vital Signs Sensor Starting...");

  // Added: WiFi connection
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi Connected!");

  Serial.println("Initializing MAX30102...");
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 NOT FOUND — check wiring!");
    while (1);
  }
  Serial.println("MAX30102 Ready");
  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x7F);
  particleSensor.setPulseAmplitudeGreen(0);

  Serial.println("Place finger on sensor...");
}

// ==========================
// LOOP
// ==========================
void loop() {

  // ── READ HEART RATE ────────────────────────────
  irValue = particleSensor.getIR();

  if (irValue > 30000) {
    if (checkForBeat(irValue)) {
      long delta     = millis() - lastBeat;
      lastBeat       = millis();
      beatsPerMinute = 60 / (delta / 1000.0);

      if (beatsPerMinute > 40 && beatsPerMinute < 180) {
        beatAvg = (beatAvg * 0.75) + (beatsPerMinute * 0.25);
        Serial.print("HR: "); Serial.print(beatAvg, 1); Serial.println(" BPM");
      }
    }
  } else {
    beatAvg = 0;
    Serial.println("No finger detected");
  }

  // ── READ THERMISTOR ────────────────────────────
  int adcValue = analogRead(THERMISTOR_PIN);
  if (adcValue > 0) {
    float r  = SERIES_RESISTOR * ((4095.0 / adcValue) - 1.0);
    float st = log(r / NOMINAL_RESISTANCE);
    st      /= B_COEFFICIENT;
    st      += 1.0 / (NOMINAL_TEMPERATURE + 273.15);
    st       = 1.0 / st - 273.15;
    temperatureC = st + TEMP_CALIBRATION;
  }

  // ── SEND TO BACKEND ────────────────────────────
  if (millis() - lastSendTime >= sendInterval) {
    lastSendTime = millis();
    sendToBackend();
  }

  // ── SERIAL OUTPUT ──────────────────────────────
  Serial.print("HR: ");      Serial.print(beatAvg, 1);
  Serial.print(" bpm | Temp: "); Serial.print(temperatureC, 1);
  Serial.println(" C");

  delay(10);
}