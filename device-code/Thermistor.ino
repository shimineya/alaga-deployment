// ===== PIN SETUP =====
const int PIN_TAPE = 4;

// ===== VARIABLES =====
int rawValue = 0;
int percent = 0;

void setup() {
  Serial.begin(115200);

  // Use internal pull-up (no resistor needed)
  pinMode(PIN_TAPE, INPUT_PULLUP);

  Serial.println("=== WATER SENSOR (PERCENTAGE MODE) ===");
  delay(2000);
}

void loop() {

  // Read analog value (0–4095)
  rawValue = analogRead(PIN_TAPE);

  // Convert to percentage (0% = dry, 100% = very wet)
  percent = map(rawValue, 4095, 0, 0, 100);

  // Print values
  Serial.print("Raw: ");
  Serial.print(rawValue);
  Serial.print(" | Wetness: ");
  Serial.print(percent);
  Serial.print("% | Status: ");

  // Status levels
  if (percent > 80) {
    Serial.println("VERY WET 💧💧💧");
  }
  else if (percent > 50) {
    Serial.println("WET 💧💧");
  }
  else if (percent > 20) {
    Serial.println("SLIGHTLY WET 💧");
  }
  else {
    Serial.println("DRY ☀️");
  }

  delay(500);
}