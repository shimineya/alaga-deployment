#include <Wire.h>
#include "MAX30105.h" // SparkFun MAX3010x Library
#include "heartRate.h"
#include <WiFi.h>
#include <HTTPClient.h>

// --- NETWORK CONFIGURATION ---
const char* ssid = "YOUR_WIFI_SSID";         // REPLACE THIS
const char* password = "YOUR_WIFI_PASSWORD"; // REPLACE THIS

// --- SERVER CONFIGURATION ---
// IMPORTANT: Use your PC's Local IP (e.g., 192.168.1.5) if testing locally. 
// Do not use "localhost" on ESP32.
const char* serverUrl = "http://192.168.X.X:3000/api/record-vitals"; 
const int PATIENT_ID = 1; // Hardcoded for prototype (matches DB patient_id)

// --- PIN DEFINITIONS ---
const int PIN_THERMISTOR = 34; // Analog Pin for NTC
const int PIN_MOISTURE = 35;   // Analog Pin for Fabric
// MAX30102 uses default I2C (SDA=21, SCL=22)

// --- SENSOR OBJECTS & VARIABLES ---
MAX30105 particleSensor;
const double VCC = 3.3;
const double R_DIVIDER = 10000.0; // 10k Resistor
const double BETA = 3950.0;       // Beta coefficient for NTC Thermistor
const double T0 = 298.15;         // 25°C in Kelvin
const double R0 = 10000.0;        // Resistance at 25°C

void setup() {
  Serial.begin(115200);
  
  // 1. Setup WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Connected!");

  // 2. Setup MAX30102
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("❌ MAX30102 not found. Check wiring.");
    while (1);
  }
  particleSensor.setup(); 
  particleSensor.setPulseAmplitudeRed(0x0A); // Low power to avoid noise
  particleSensor.setPulseAmplitudeGreen(0); 

  // 3. Setup Analog Pins
  pinMode(PIN_THERMISTOR, INPUT);
  pinMode(PIN_MOISTURE, INPUT);
}

void loop() {
  // --- A. READ SENSORS ---
  
  // 1. Temperature (Steinhart-Hart Equation)
  int tempADC = analogRead(PIN_THERMISTOR);
  double temperatureC = 0.0;
  if (tempADC > 0) { // Avoid division by zero
      double Vout = tempADC * (VCC / 4095.0);
      double R_NTC = (Vout * R_DIVIDER) / (VCC - Vout);
      temperatureC = 1.0 / (1.0 / T0 + log(R_NTC / R0) / BETA) - 273.15;
  }
  
  // 2. Moisture (Raw Analog Value 0-4095)
  int moistureValue = analogRead(PIN_MOISTURE);
  
  // 3. Heart Rate & SpO2 (Simplified simulation for stability if sensor is finicky)
  // Note: Real MAX30102 HR calculation requires complex buffering. 
  // For basic checking, we read the IR value.
  long irValue = particleSensor.getIR();
  int heartRate = 0;
  int spo2 = 0;
  
  // Basic threshold to check if finger is on sensor
  if (irValue > 50000) { 
      heartRate = random(60, 100); // Placeholder: Replace with real beat detection logic
      spo2 = random(95, 99);       // Placeholder
  }

  // --- B. PRINT DEBUGGING ---
  Serial.print("Temp: "); Serial.print(temperatureC);
  Serial.print("°C | Wetness: "); Serial.print(moistureValue);
  Serial.print(" | IR: "); Serial.println(irValue);

  // --- C. SEND DATA TO SERVER (Every 5 Seconds) ---
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // Create JSON Payload
    String jsonPayload = "{";
    jsonPayload += "\"patient_id\": " + String(PATIENT_ID) + ",";
    jsonPayload += "\"heart_rate\": " + String(heartRate) + ",";
    jsonPayload += "\"spo2\": " + String(spo2) + ",";
    jsonPayload += "\"temperature\": " + String(temperatureC) + ",";
    jsonPayload += "\"moisture_value\": " + String(moistureValue);
    jsonPayload += "}";

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("✅ Data Sent: " + response);
    } else {
      Serial.print("❌ Error sending POST: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }

  delay(5000); // Wait 5 seconds before next reading
}