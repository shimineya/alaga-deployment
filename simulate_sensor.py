# -*- coding: utf-8 -*-
import sys, io
# Force UTF-8 output on Windows so box-drawing/colour chars render correctly
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
"""
Alaga Sensor Simulator
======================
Tests the OC-SVM AI model end-to-end with the PostgreSQL database.
No ESP32 device, no Flask server, and no HTTP layer required.

What this script does for each test scenario:
  1. Calls predict() directly from 04_predict.py (the OC-SVM model)
  2. Writes the raw reading to sensor_readings table
  3. If alerts fired, writes to anomaly_events + alert_notifications
  4. Prints a clear PASS/FAIL result to the terminal

After running, open pgAdmin 4 and run:
  SELECT * FROM sensor_readings ORDER BY recorded_at DESC LIMIT 20;
  SELECT * FROM anomaly_events  ORDER BY detected_at  DESC LIMIT 20;
  SELECT * FROM alert_notifications ORDER BY sent_at  DESC LIMIT 20;

The Flutter app will show the alerts on its next poll of GET /api/alerts/clinical.

Usage (run from the project root):
  python simulate_sensor.py

Requirements:
  pip install psycopg2-binary python-dotenv scikit-learn numpy joblib
"""

import sys
import os
import json
from datetime import datetime

# ---------------------------------------------------------------------------
# Load .env from backend/.env so we reuse the same DB credentials
# ---------------------------------------------------------------------------
from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env")
load_dotenv(ENV_PATH)

# ---------------------------------------------------------------------------
# Add the AI model scripts folder to path
# ---------------------------------------------------------------------------
SCRIPTS_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "alaga-oc-svm-main", "alaga-oc-svm-main", "scripts"
)
sys.path.insert(0, SCRIPTS_DIR)

# Import the predict function directly — no Flask, no HTTP
import importlib.util
spec = importlib.util.spec_from_file_location(
    "predict", os.path.join(SCRIPTS_DIR, "04_predict.py")
)
predict_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(predict_module)

predict        = predict_module.predict
flag_as_normal = predict_module.flag_as_normal

# ---------------------------------------------------------------------------
# Connect to PostgreSQL
# ---------------------------------------------------------------------------
import psycopg2
import psycopg2.extras

def get_db_connection():
    return psycopg2.connect(
        host     = os.getenv("DB_HOST",     "localhost"),
        port     = int(os.getenv("DB_PORT", "5432")),
        dbname   = os.getenv("DB_NAME",     "alaga_db"),
        user     = os.getenv("DB_USER",     "postgres"),
        password = os.getenv("DB_PASSWORD", ""),
    )

# ---------------------------------------------------------------------------
# Colour output (works on Windows PowerShell)
# ---------------------------------------------------------------------------
RESET  = "\033[0m"
BOLD   = "\033[1m"
RED    = "\033[31m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
CYAN   = "\033[36m"
GREY   = "\033[90m"

def line():  print(GREY + "-" * 65 + RESET)
def passed(msg): print(f"  {GREEN}PASS{RESET}  {msg}")
def failed(msg): print(f"  {RED}FAIL{RESET}  {msg}")
def info(msg):   print(f"  {CYAN}INFO{RESET}  {msg}")
def warn(msg):   print(f"  {YELLOW}WARN{RESET}  {msg}")

# ---------------------------------------------------------------------------
# Clinical Test Scenarios
# expected_status is what the AI SHOULD return
# ---------------------------------------------------------------------------
SCENARIOS = [
    {
        "label"          : "Normal adult vitals",
        "expected_status": "NORMAL",
        "heart_rate"     : 75,
        "temperature"    : 36.8,
        "spo2"           : 98,
        "moisture"       : 0,
        "patient_type"   : "adult",
    },
    {
        "label"          : "Normal infant vitals",
        "expected_status": "NORMAL",
        "heart_rate"     : 130,
        "temperature"    : 37.0,
        "spo2"           : 97,
        "moisture"       : 0,
        "patient_type"   : "infant",
    },
    {
        "label"          : "Fever detected (39.2 C)",
        "expected_status": "CRITICAL",
        "heart_rate"     : 88,
        "temperature"    : 39.2,
        "spo2"           : 96,
        "moisture"       : 0,
        "patient_type"   : "adult",
    },
    {
        "label"          : "Hypothermia risk (34.5 C)",
        "expected_status": "CRITICAL",
        "heart_rate"     : 60,
        "temperature"    : 34.5,
        "spo2"           : 97,
        "moisture"       : 0,
        "patient_type"   : "adult",
    },
    {
        "label"          : "Critical low SpO2 — Hypoxia (85%)",
        "expected_status": "CRITICAL",
        "heart_rate"     : 95,
        "temperature"    : 36.9,
        "spo2"           : 85,
        "moisture"       : 0,
        "patient_type"   : "adult",
    },
    {
        "label"          : "Warning SpO2 (93%)",
        "expected_status": "WARNING",
        "heart_rate"     : 82,
        "temperature"    : 36.7,
        "spo2"           : 93,
        "moisture"       : 0,
        "patient_type"   : "adult",
    },
    {
        "label"          : "Adult tachycardia (HR 115 bpm)",
        "expected_status": "WARNING",
        "heart_rate"     : 115,
        "temperature"    : 36.9,
        "spo2"           : 97,
        "moisture"       : 0,
        "patient_type"   : "adult",
    },
    {
        "label"          : "Infant tachycardia (HR 165 bpm)",
        "expected_status": "WARNING",
        "heart_rate"     : 165,
        "temperature"    : 37.0,
        "spo2"           : 97,
        "moisture"       : 0,
        "patient_type"   : "infant",
    },
    {
        "label"          : "Bradycardia (HR 42 bpm)",
        "expected_status": "CRITICAL",
        "heart_rate"     : 42,
        "temperature"    : 36.8,
        "spo2"           : 97,
        "moisture"       : 0,
        "patient_type"   : "adult",
    },
    {
        "label"          : "No pulse detected (HR 0)",
        "expected_status": "CRITICAL",
        "heart_rate"     : 0,
        "temperature"    : 36.8,
        "spo2"           : 97,
        "moisture"       : 0,
        "patient_type"   : "adult",
    },
    {
        "label"          : "Wet diaper detected",
        "expected_status": "WARNING",
        "heart_rate"     : 120,
        "temperature"    : 36.7,
        "spo2"           : 98,
        "moisture"       : 1,
        "patient_type"   : "infant",
    },
    {
        "label"          : "Multiple flags — fever + low SpO2 + wet diaper",
        "expected_status": "CRITICAL",
        "heart_rate"     : 95,
        "temperature"    : 39.5,
        "spo2"           : 86,
        "moisture"       : 1,
        "patient_type"   : "adult",
    },
]


def write_to_database(conn, patient_id, scenario, ai_result):
    """
    Writes the simulated reading and AI result to PostgreSQL.
    Mirrors exactly what sensorRoutes.js does for a real ESP32 reading.
    """
    with conn.cursor() as cur:
        # Step 1: Insert raw reading into sensor_readings
        # [HIPAA] Every PHI data point must have an immutable record
        cur.execute(
            """INSERT INTO sensor_readings
                   (patient_id, heart_rate, spo2, temperature, moisture_value)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING reading_id""",
            (
                patient_id,
                round(scenario["heart_rate"]),
                round(scenario["spo2"]),
                scenario["temperature"],
                scenario["moisture"],
            )
        )
        reading_id = cur.fetchone()[0]

        # Step 2: For each alert, insert anomaly_event + alert_notification
        # [OWASP A05] Parameterized queries — no injection risk
        for alert in ai_result.get("alerts", []):
            ocsvm_score  = -1.0 if alert["vital"] == "multi_feature" else 0.0
            anomaly_type = "ocsvm_anomaly" if alert["vital"] == "multi_feature" \
                           else f"rule_{alert['vital']}"

            cur.execute(
                """INSERT INTO anomaly_events
                       (patient_id, reading_id, anomaly_type, ocsvm_score)
                   VALUES (%s, %s, %s, %s)
                   RETURNING event_id""",
                (patient_id, reading_id, anomaly_type, ocsvm_score)
            )
            event_id = cur.fetchone()[0]

            db_severity = "Critical" if alert["severity"] == "critical" else "Warning"

            cur.execute(
                """INSERT INTO alert_notifications
                       (event_id, status, message, severity, alert_category)
                   VALUES (%s, 'Sent', %s, %s, 'Clinical')""",
                (event_id, alert["message"], db_severity)
            )

        # Step 3: Write PHI access log
        # [HIPAA / OWASP A09] Audit trail for every PHI write
        cur.execute(
            """INSERT INTO access_logs
                   (target_patient_id, action, severity, status, details)
               VALUES (%s, 'SIMULATED_SENSOR_READING', 'INFO', 'SUCCESS', %s)""",
            (
                patient_id,
                json.dumps({
                    "source"    : "simulate_sensor.py",
                    "reading_id": reading_id,
                    "ai_status" : ai_result.get("status"),
                    "ocsvm"     : ai_result.get("ocsvm_result"),
                    "scenario"  : scenario["label"],
                })
            )
        )

    conn.commit()
    return reading_id


def run_simulation(patient_id):
    print()
    print(BOLD + "=" * 65 + RESET)
    print(BOLD + "  Alaga Sensor Simulator" + RESET)
    print(BOLD + "  OC-SVM + PostgreSQL — No device required" + RESET)
    print(BOLD + "=" * 65 + RESET)

    # -- Connect to database --------------------------------------------------
    info(f"Connecting to PostgreSQL ({os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')})...")
    try:
        conn = get_db_connection()
        passed("Database connection established")
    except Exception as e:
        failed(f"Cannot connect to PostgreSQL: {e}")
        print(f"\n  Check that backend/.env has the correct DB_* values")
        sys.exit(1)

    # -- Verify patient exists ------------------------------------------------
    with conn.cursor() as cur:
        cur.execute(
            "SELECT patient_id, name, patient_type FROM patients WHERE patient_id = %s",
            (patient_id,)
        )
        row = cur.fetchone()
    if not row:
        failed(f"Patient ID {patient_id} not found in the patients table.")
        print(f"\n  Either create a patient in the system first, or change")
        print(f"  PATIENT_ID at the bottom of this script to a valid ID.")
        conn.close()
        sys.exit(1)

    _, patient_name, patient_type_from_db = row
    info(f"Sending readings for patient: {patient_name} (ID {patient_id})")

    line()
    total  = len(SCENARIOS)
    passed_count = 0
    failed_count = 0
    rows_written = []

    for i, scenario in enumerate(SCENARIOS, 1):
        label    = scenario["label"]
        expected = scenario["expected_status"]

        # Override patient_type from DB so the right HR threshold applies
        effective_type = scenario["patient_type"]

        try:
            # Call OC-SVM predict() directly — no HTTP, no Flask
            result = predict(
                patient_id   = str(patient_id),
                heart_rate   = scenario["heart_rate"],
                temperature  = scenario["temperature"],
                spo2         = scenario["spo2"],
                moisture     = scenario["moisture"],
                patient_type = effective_type,
            )

            ai_status   = result["status"]
            ocsvm_label = result["ocsvm_result"]
            alerts      = result["alerts"]

            # Write to database
            reading_id = write_to_database(conn, patient_id, scenario, result)
            rows_written.append(reading_id)

            status_match = (ai_status == expected)
            tag = f"[{i:02d}/{total}]"

            if status_match:
                passed(f"{tag} {label}")
                passed_count += 1
            else:
                failed(f"{tag} {label}")
                print(f"         Expected: {expected}  |  Got: {ai_status}")
                failed_count += 1

            # Print alerts
            for alert in alerts:
                colour = RED if alert["severity"] == "critical" else YELLOW
                print(f"         {colour}[{alert['severity'].upper()}]{RESET} {alert['message']}")

            print(f"         {GREY}OC-SVM: {ocsvm_label} | reading_id: {reading_id}{RESET}")

        except Exception as e:
            failed(f"[{i:02d}/{total}] {label} — Error: {e}")
            failed_count += 1

    # -- Summary --------------------------------------------------------------
    line()
    colour = GREEN if failed_count == 0 else RED
    print(f"\n  {BOLD}Results:{RESET} {colour}{passed_count} passed, {failed_count} failed{RESET} out of {total} scenarios")
    print(f"  {BOLD}Readings written to DB:{RESET} {len(rows_written)}")
    print(f"  {BOLD}Reading IDs:{RESET} {rows_written}")

    print(f"""
  {BOLD}Verify in pgAdmin 4 with these queries:{RESET}

  -- Raw sensor readings (simulated):
  SELECT reading_id, heart_rate, spo2, temperature, moisture_value, recorded_at
  FROM sensor_readings
  WHERE patient_id = {patient_id}
  ORDER BY recorded_at DESC LIMIT {total};

  -- Anomaly events (AI detections):
  SELECT event_id, reading_id, anomaly_type, ocsvm_score, detected_at
  FROM anomaly_events
  WHERE patient_id = {patient_id}
  ORDER BY detected_at DESC LIMIT 20;

  -- Alert notifications (what Flutter shows):
  SELECT an.alert_id, an.message, an.severity, an.status, an.sent_at
  FROM alert_notifications an
  JOIN anomaly_events ae ON an.event_id = ae.event_id
  WHERE ae.patient_id = {patient_id}
  ORDER BY an.sent_at DESC LIMIT 20;
""")

    conn.close()


# =============================================================================
# ENTRY POINT
# Change PATIENT_ID to any valid patient_id from your patients table.
# =============================================================================
if __name__ == "__main__":
    PATIENT_ID = 1   # <-- Change this to a valid patient_id in your DB

    run_simulation(PATIENT_ID)
