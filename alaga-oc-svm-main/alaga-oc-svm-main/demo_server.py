"""
ALAGA Demo Server
-----------------
Receives sensor readings from ESP32
Runs OC-SVM predict() on each reading
Serves latest results to Flutter app

Run with: python demo_server.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import json
from datetime import datetime

# ── Add scripts folder to path so we can import predict ───────────────────
scripts_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts')
sys.path.insert(0, scripts_path)

import importlib.util
spec = importlib.util.spec_from_file_location("predict", os.path.join(scripts_path, "04_predict.py"))
predict_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(predict_module)

predict = predict_module.predict
flag_as_normal = predict_module.flag_as_normal
PATIENT_BASELINES = predict_module.PATIENT_BASELINES

app = Flask(__name__)
CORS(app)  # allow Flutter app to connect

# ── In-memory store (no database needed for demo) ─────────────────────────
latest_readings  = {}   # { patient_id: latest reading + AI result }
reading_history  = {}   # { patient_id: [last 10 readings] }
active_alerts    = {}   # { patient_id: alert info }

# ── Demo patients (matches your Flutter hardcoded patients) ────────────────
DEMO_PATIENTS = {
    "P001": {"name": "First Patient",  "patient_type": "adult"},
    "P002": {"name": "Fourth Patient", "patient_type": "adult"},
    "P003": {"name": "Juan Cruz",      "patient_type": "adult"},
    "P004": {"name": "Dad Dada",       "patient_type": "adult"},
}

# ══════════════════════════════════════════════════════════════════════════
# ENDPOINT 1: ESP32 #1 posts vital signs here
# POST /reading
# ══════════════════════════════════════════════════════════════════════════
@app.route('/reading', methods=['POST'])
def receive_reading():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON received"}), 400

        patient_id   = data.get('patient_id',   'P001')
        heart_rate   = float(data.get('heart_rate',   0))
        temperature  = float(data.get('temperature',  36.5))
        spo2         = float(data.get('spo2',         97))
        patient_type = data.get('patient_type', 'adult')

        # Fix temperature if thermistor not connected
        if temperature < 0 or temperature > 50:
            temperature = 36.5

        if heart_rate <= 0:
            heart_rate = 0

        # Keep existing moisture from ESP32 #2 if already received
        existing_moisture = 0
        if patient_id in latest_readings:
            existing_moisture = latest_readings[patient_id].get('moisture', 0)

        print(f"\n📥 Vitals from {patient_id}:")
        print(f"   HR: {heart_rate} bpm | Temp: {temperature}°C | "
              f"SpO2: {spo2}% | Moisture: {existing_moisture}")

        result = predict(
            patient_id   = patient_id,
            heart_rate   = heart_rate,
            temperature  = temperature,
            spo2         = spo2,
            moisture     = existing_moisture,
            patient_type = patient_type
        )

        print(f"   AI Status: {result['status']}")
        if result['alerts']:
            for alert in result['alerts']:
                print(f"   🚨 {alert['message']}")

        latest_readings[patient_id] = {
            "patient_id"  : patient_id,
            "name"        : DEMO_PATIENTS.get(patient_id, {}).get('name', patient_id),
            "heart_rate"  : round(heart_rate, 1),
            "temperature" : round(temperature, 1),
            "spo2"        : round(spo2, 1),
            "moisture"    : existing_moisture,
            "status"      : result['status'],
            "alerts"      : result['alerts'],
            "ocsvm_result": result['ocsvm_result'],
            "timestamp"   : datetime.now().isoformat()
        }

        if patient_id not in reading_history:
            reading_history[patient_id] = []
        reading_history[patient_id].append({
            "heart_rate" : round(heart_rate, 1),
            "temperature": round(temperature, 1),
            "spo2"       : round(spo2, 1),
            "moisture"   : existing_moisture,
            "status"     : result['status'],
            "timestamp"  : datetime.now().isoformat()
        })
        reading_history[patient_id] = reading_history[patient_id][-10:]

        if result['alerts']:
            active_alerts[patient_id] = {
                "patient_id"  : patient_id,
                "name"        : DEMO_PATIENTS.get(patient_id, {}).get('name', patient_id),
                "status"      : result['status'],
                "alerts"      : result['alerts'],
                "timestamp"   : datetime.now().isoformat(),
                "dismissed"   : False
            }
        else:
            if patient_id in active_alerts:
                active_alerts[patient_id]['dismissed'] = True

        return jsonify({
            "success": True,
            "status" : result['status'],
            "alerts" : result['alerts']
        }), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"error": str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════
# ENDPOINT 2: ESP32 #2 posts moisture reading here
# POST /moisture
# ══════════════════════════════════════════════════════════════════════════
@app.route('/moisture', methods=['POST'])
def receive_moisture():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON received"}), 400

        patient_id = data.get('patient_id', 'P001')
        moisture   = int(data.get('moisture', 0))
        percent    = int(data.get('percent',  0))

        print(f"\n💧 Moisture from {patient_id}: {percent}% "
              f"({'WET' if moisture else 'DRY'})")

        if patient_id in latest_readings:
            # Update moisture and re-run AI with all current values
            latest_readings[patient_id]['moisture'] = moisture
            reading      = latest_readings[patient_id]
            patient_type = DEMO_PATIENTS.get(patient_id, {}).get('patient_type', 'adult')

            result = predict(
                patient_id   = patient_id,
                heart_rate   = reading['heart_rate'],
                temperature  = reading['temperature'],
                spo2         = reading['spo2'],
                moisture     = moisture,
                patient_type = patient_type
            )

            latest_readings[patient_id]['status'] = result['status']
            latest_readings[patient_id]['alerts'] = result['alerts']

            print(f"   AI Status: {result['status']}")
            if result['alerts']:
                for alert in result['alerts']:
                    print(f"   🚨 {alert['message']}")

            if result['alerts']:
                active_alerts[patient_id] = {
                    "patient_id": patient_id,
                    "name"      : DEMO_PATIENTS.get(patient_id, {}).get('name', patient_id),
                    "status"    : result['status'],
                    "alerts"    : result['alerts'],
                    "timestamp" : datetime.now().isoformat(),
                    "dismissed" : False
                }
            else:
                if patient_id in active_alerts:
                    active_alerts[patient_id]['dismissed'] = True

        else:
            # No vitals yet — store moisture only, alert if wet
            print(f"   No vitals yet for {patient_id}, storing moisture only")
            latest_readings[patient_id] = {
                "patient_id"  : patient_id,
                "name"        : DEMO_PATIENTS.get(patient_id, {}).get('name', patient_id),
                "heart_rate"  : 0,
                "temperature" : 36.5,
                "spo2"        : 97,
                "moisture"    : moisture,
                "status"      : "WARNING" if moisture else "NORMAL",
                "alerts"      : [{"vital": "moisture", "message": "WET DIAPER detected — Caregiver action needed", "severity": "warning"}] if moisture else [],
                "ocsvm_result": "normal",
                "timestamp"   : datetime.now().isoformat()
            }
            if moisture:
                active_alerts[patient_id] = {
                    "patient_id": patient_id,
                    "name"      : DEMO_PATIENTS.get(patient_id, {}).get('name', patient_id),
                    "status"    : "WARNING",
                    "alerts"    : [{"vital": "moisture", "message": "WET DIAPER detected — Caregiver action needed", "severity": "warning"}],
                    "timestamp" : datetime.now().isoformat(),
                    "dismissed" : False
                }

        return jsonify({"success": True, "moisture": moisture}), 200

    except Exception as e:
        print(f"❌ Moisture error: {e}")
        return jsonify({"error": str(e)}), 500


# ══════════════════════════════════════════════════════════════════════════
# ENDPOINT 3: Flutter fetches all patients' latest readings
# GET /patients
# ══════════════════════════════════════════════════════════════════════════
@app.route('/patients', methods=['GET'])
def get_patients():
    patients = []
    for patient_id, info in DEMO_PATIENTS.items():
        if patient_id in latest_readings:
            reading = latest_readings[patient_id]
            patients.append({
                "patient_id" : patient_id,
                "name"       : info['name'],
                "heart_rate" : reading['heart_rate'],
                "temperature": reading['temperature'],
                "spo2"       : reading['spo2'],
                "moisture"   : reading['moisture'],
                "status"     : reading['status'],
                "alerts"     : reading['alerts'],
                "timestamp"  : reading['timestamp']
            })
        else:
            patients.append({
                "patient_id" : patient_id,
                "name"       : info['name'],
                "heart_rate" : 0,
                "temperature": 0,
                "spo2"       : 0,
                "moisture"   : 0,
                "status"     : "Offline",
                "alerts"     : [],
                "timestamp"  : None
            })
    return jsonify(patients), 200


# ══════════════════════════════════════════════════════════════════════════
# ENDPOINT 4: Flutter fetches one patient's reading + history
# GET /patient/<patient_id>
# ══════════════════════════════════════════════════════════════════════════
@app.route('/patient/<patient_id>', methods=['GET'])
def get_patient(patient_id):
    if patient_id not in latest_readings:
        return jsonify({"status": "Offline", "message": "No readings yet"}), 404

    history = reading_history.get(patient_id, [])
    result  = latest_readings[patient_id].copy()
    result['history'] = history
    return jsonify(result), 200


# ══════════════════════════════════════════════════════════════════════════
# ENDPOINT 5: Flutter fetches active alerts (for global popup)
# GET /alerts
# ══════════════════════════════════════════════════════════════════════════
@app.route('/alerts', methods=['GET'])
def get_alerts():
    active = [
        a for a in active_alerts.values()
        if not a.get('dismissed', False)
    ]
    return jsonify(active), 200


# ══════════════════════════════════════════════════════════════════════════
# ENDPOINT 6: Caregiver dismisses an alert
# POST /dismiss/<patient_id>
# ══════════════════════════════════════════════════════════════════════════
@app.route('/dismiss/<patient_id>', methods=['POST'])
def dismiss_alert(patient_id):
    if patient_id in active_alerts:
        active_alerts[patient_id]['dismissed'] = True
        return jsonify({"success": True}), 200
    return jsonify({"error": "No alert found"}), 404


# ══════════════════════════════════════════════════════════════════════════
# ENDPOINT 7: Caregiver flags a reading as normal
# POST /flag/<patient_id>
# Body: { "vital": "heart_rate", "value": 132 }
# ══════════════════════════════════════════════════════════════════════════
@app.route('/flag/<patient_id>', methods=['POST'])
def flag_reading(patient_id):
    data  = request.get_json()
    vital = data.get('vital')
    value = float(data.get('value'))
    msg   = flag_as_normal(patient_id, vital, value)
    print(f"🏳️  Flag: {msg}")
    return jsonify({"message": msg}), 200


# ══════════════════════════════════════════════════════════════════════════
# STARTUP
# ══════════════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    print("══════════════════════════════════════════")
    print("  ALAGA Demo Server Starting...")
    print("══════════════════════════════════════════")
    print("  Endpoints:")
    print("  POST /reading      ← ESP32 #1 vital signs")
    print("  POST /moisture     ← ESP32 #2 diaper moisture")
    print("  GET  /patients     ← Flutter fetches all patients")
    print("  GET  /patient/<id> ← Flutter fetches one patient")
    print("  GET  /alerts       ← Flutter fetches active alerts")
    print("  POST /dismiss/<id> ← Dismiss an alert")
    print("  POST /flag/<id>    ← Flag reading as normal")
    print("══════════════════════════════════════════")
    print("  Make sure ESP32s, laptop, and phone are")
    print("  all on the same WiFi network!")
    print("══════════════════════════════════════════\n")

    app.run(host='0.0.0.0', port=5000, debug=False)