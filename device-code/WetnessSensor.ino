#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h> // Added: Library for backend communication

// ==========================
// WIFI SETTINGS
// ==========================
const char* ssid = "kaleidoscope";
const char* password = "LightHouse4th";

// ==========================
// BACKEND SETTINGS
// ==========================
const char* serverURL = "http://192.168.100.185:3000/api/sensor/reading"; // Updated backend endpoint
const char* deviceID  = "SD-2026-0001"; // Registered identity

// ==========================
// WEB SERVER
// ==========================
WebServer server(80);

// ==========================
// WATER SENSOR
// ==========================
const int WATER_PIN = 4;

int waterState = 0;
int wetnessPercent = 0;

// ==========================
// TIMING
// ==========================
unsigned long lastSendTime = 0;
const long sendInterval = 5000;

// ==========================
// WEBPAGE
// ==========================
void handleRoot()
{
  String page = "";

  page += "<html>";
  page += "<head>";
  page += "<meta http-equiv='refresh' content='2'>";
  page += "</head>";

  page += "<body style='font-family:Arial;text-align:center;'>";

  page += "<h1>💧 ESP32 Wetness Monitor</h1>";

  // Wetness %
  page += "<h2>Wetness Level</h2>";

  page += "<h1>";
  page += wetnessPercent;
  page += "%";
  page += "</h1>";

  // Status
  if (wetnessPercent > 70)
  {
    page += "<h2>VERY WET 💧💧💧</h2>";
  }
  else if (wetnessPercent > 30)
  {
    page += "<h2>WET 💧💧</h2>";
  }
  else
  {
    page += "<h2>DRY ☀️</h2>";
  }

  page += "</body>";
  page += "</html>";

  server.send(200, "text/html", page);
}

// ==========================
// SEND TO BACKEND
// ==========================
void sendToBackend()
{
  if (WiFi.status() == WL_CONNECTED)
  {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    // [OWASP A07] Authentication headers required by backend
    http.addHeader("X-Device-Serial", deviceID);
    http.addHeader("X-Device-Token", "alaga-test-token");

    String payload = "{\"device_id\":\"" + String(deviceID) + 
                     "\",\"heart_rate\":0,\"temperature\":0,\"spo2\":0,\"moisture\":" + 
                     String(wetnessPercent) + "}";

    int code = http.POST(payload);
    Serial.println("Backend Response Code: " + String(code));
    http.end();
  }
}

// ==========================
// SETUP
// ==========================
void setup()
{
  Serial.begin(115200);

  // Water sensor input
  pinMode(WATER_PIN, INPUT_PULLDOWN);

  // ==========================
  // CONNECT WIFI
  // ==========================
  WiFi.begin(ssid, password);

  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("==========================");
  Serial.println("WiFi Connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.println("==========================");

  // ==========================
  // START WEB SERVER
  // ==========================
  server.on("/", handleRoot);

  server.begin();

  Serial.println("Web Server Started!");
}

// ==========================
// LOOP
// ==========================
void loop()
{
  // Handle browser requests
  server.handleClient();

  // Read sensor
  waterState = digitalRead(WATER_PIN);

  // ==========================
  // SIMPLE WETNESS %
  // ==========================
  // [VALIDATION FIX] Backend strictly requires 1 (Wet) or 0 (Dry)
  if (waterState == HIGH)
  {
    wetnessPercent = 1;
  }
  else
  {
    wetnessPercent = 0;
  }

  // ==========================
  // SEND TO BACKEND
  // ==========================
  if (millis() - lastSendTime >= sendInterval)
  {
    lastSendTime = millis();
    sendToBackend();
  }

  // ==========================
  // SERIAL MONITOR
  // ==========================
  Serial.print("Wetness: ");
  Serial.print(wetnessPercent);
  Serial.println("%");

  delay(500);
}