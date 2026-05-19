#include <PulseSensorPlayground.h>

#include <PulseSensorPlayground.h>

// Pins
const int PULSE_PIN = 34;
const int BUZZER_PIN = 5;

// Pulse sensor object
PulseSensorPlayground pulseSensor;

// Variables
int BPM;

void setup() {
  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  pulseSensor.analogInput(PULSE_PIN);
  pulseSensor.setThreshold(550); // adjust if needed

  if (pulseSensor.begin()) {
    Serial.println("Pulse sensor ready. Place on wrist.");
  } else {
    Serial.println("Sensor not detected!");
  }
}

void loop() {

  BPM = pulseSensor.getBeatsPerMinute();

  if (pulseSensor.sawStartOfBeat()) {

    Serial.print("BPM: ");
    Serial.println(BPM);

    // 🚨 ALERT
    if (BPM < 50 || BPM > 120) {
      digitalWrite(BUZZER_PIN, HIGH); // beep
    } else {
      digitalWrite(BUZZER_PIN, LOW);
    }
  }

  delay(20);
}