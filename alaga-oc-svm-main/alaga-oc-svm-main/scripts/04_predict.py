import numpy as np
import joblib
import os
from datetime import datetime

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR   = os.path.join(BASE_DIR, "models")
MODEL_PATH  = os.path.join(MODEL_DIR, "ocsvm_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")

# ── Load model and scaler once (reused for every prediction) ───────────────
model  = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)

# ══════════════════════════════════════════════════════════════════════════
# COLD-START SAFETY FLOORS
# These trigger REGARDLESS of what the OC-SVM says.
# Based on WHO/clinical standards — non-negotiable alerts.
# ══════════════════════════════════════════════════════════════════════════
COLD_START_RULES = {
    "spo2_critical"    : 90.0,   # SpO2 below this = hypoxia emergency
    "temp_fever"       : 38.0,   # Temp above this = fever
    "hr_high_infant"   : 160,    # HR above this = infant tachycardia
    "hr_high_adult"    : 100,    # HR above this = adult tachycardia
    "hr_low"           : 50,     # HR below this = bradycardia (dangerous)
    "spo2_warning"     : 94.0,   # SpO2 below this = warning (not yet critical)
    "temp_hypothermia" : 35.0,   # Temp below this = hypothermia
}

# ══════════════════════════════════════════════════════════════════════════
# ADAPTIVE BASELINE STORE
# In production this lives in your PostgreSQL database.
# Structure: { patient_id: { vital: { mean, upper, lower, flag_count } } }
# ══════════════════════════════════════════════════════════════════════════
PATIENT_BASELINES = {}
FLAG_THRESHOLD    = 5       # flags needed to personalize
TOLERANCE = {
    "heart_rate" : 10.0,    # ±10 bpm
    "temperature": 0.5,     # ±0.5°C
    "spo2"       : 2.0,     # ±2%
}


def check_cold_start(heart_rate, temperature, spo2, moisture,
                     patient_type="adult"):
    """
    Layer 1: Hardcoded clinical safety floors.
    Returns list of alerts. Empty list = no cold-start triggers.
    patient_type: 'infant' or 'adult'
    """
    alerts = []
    severity = "normal"

    # SpO2 checks
    if spo2 < COLD_START_RULES["spo2_critical"]:
        alerts.append({
            "vital"    : "spo2",
            "value"    : spo2,
            "message"  : f"CRITICAL: SpO2 at {spo2:.1f}% — Hypoxia risk",
            "severity" : "critical"
        })
    elif spo2 < COLD_START_RULES["spo2_warning"]:
        alerts.append({
            "vital"    : "spo2",
            "value"    : spo2,
            "message"  : f"WARNING: SpO2 at {spo2:.1f}% — Monitor closely",
            "severity" : "warning"
        })

    # Temperature checks
    if temperature > COLD_START_RULES["temp_fever"]:
        alerts.append({
            "vital"    : "temperature",
            "value"    : temperature,
            "message"  : f"FEVER detected: {temperature:.1f}°C",
            "severity" : "critical"
        })
    elif temperature < COLD_START_RULES["temp_hypothermia"]:
        alerts.append({
            "vital"    : "temperature",
            "value"    : temperature,
            "message"  : f"HYPOTHERMIA risk: {temperature:.1f}°C",
            "severity" : "critical"
        })

    # Heart rate checks
    hr_threshold = (COLD_START_RULES["hr_high_infant"]
                    if patient_type == "infant"
                    else COLD_START_RULES["hr_high_adult"])

    if heart_rate > hr_threshold:
        alerts.append({
            "vital"    : "heart_rate",
            "value"    : heart_rate,
            "message"  : f"HIGH HEART RATE: {heart_rate:.0f} bpm (>{hr_threshold})",
            "severity" : "warning"
        })
    elif heart_rate < COLD_START_RULES["hr_low"]:
        alerts.append({
            "vital"    : "heart_rate",
            "value"    : heart_rate,
            "message"  : f"{'EMERGENCY: No pulse detected!' if heart_rate == 0 else f'LOW HEART RATE: {heart_rate:.0f} bpm — Bradycardia risk'}",
            "severity" : "critical"
        })

    # Moisture check
    if moisture == 1:
        alerts.append({
            "vital"    : "moisture",
            "value"    : moisture,
            "message"  : "WET DIAPER detected — Caregiver action needed",
            "severity" : "warning"
        })

    return alerts


def is_suppressed_by_baseline(patient_id, vital, value):
    """
    Check if this reading falls within the patient's
    personalized baseline (i.e. caregiver has flagged it
    as normal 5+ times). Returns True if alert should be suppressed.
    """
    if patient_id not in PATIENT_BASELINES:
        return False
    if vital not in PATIENT_BASELINES[patient_id]:
        return False

    baseline = PATIENT_BASELINES[patient_id][vital]
    if baseline.get("flag_count", 0) < FLAG_THRESHOLD:
        return False

    return baseline["lower"] <= value <= baseline["upper"]


def flag_as_normal(patient_id, vital, value):
    """
    Called when caregiver taps 'Flag as Normal' in the app.
    After FLAG_THRESHOLD flags, personalizes the patient baseline.
    Returns a status message.
    """
    if patient_id not in PATIENT_BASELINES:
        PATIENT_BASELINES[patient_id] = {}

    if vital not in PATIENT_BASELINES[patient_id]:
        PATIENT_BASELINES[patient_id][vital] = {
            "flag_count": 0,
            "flagged_values": [],
            "mean": None,
            "upper": None,
            "lower": None
        }

    entry = PATIENT_BASELINES[patient_id][vital]
    entry["flag_count"]     += 1
    entry["flagged_values"].append(value)

    if entry["flag_count"] >= FLAG_THRESHOLD:
        mean  = np.mean(entry["flagged_values"])
        tol   = TOLERANCE.get(vital, 5.0)
        entry["mean"]  = round(mean, 2)
        entry["upper"] = round(mean + tol, 2)
        entry["lower"] = round(mean - tol, 2)
        return (f"✅ Baseline personalized for patient {patient_id} | "
                f"{vital}: {entry['lower']} – {entry['upper']} "
                f"(mean {entry['mean']}). Alerts suppressed in this range.")
    else:
        remaining = FLAG_THRESHOLD - entry["flag_count"]
        return (f"Flag {entry['flag_count']}/{FLAG_THRESHOLD} recorded. "
                f"{remaining} more flag(s) needed to personalize baseline.")


def predict(patient_id, heart_rate, temperature, spo2, moisture,
            patient_type="adult"):
    """
    Main prediction function — called by your backend per sensor reading.

    Parameters:
        patient_id   : str  — unique patient identifier
        heart_rate   : float — bpm
        temperature  : float — °C
        spo2         : float — %
        moisture     : int   — 0 (dry) or 1 (wet)
        patient_type : str  — 'infant' or 'adult'

    Returns:
        dict with keys: status, alerts, ocsvm_result, timestamp
    """
    alerts   = []
    suppress = {}  # tracks which vitals are suppressed by personal baseline

    # ── Layer 1: Cold-Start Safety Floors ─────────────────────────────────
    cold_alerts = check_cold_start(heart_rate, temperature, spo2,
                                   moisture, patient_type)

    for alert in cold_alerts:
        vital = alert["vital"]
        value = alert["value"]

        # Cold-start CRITICAL alerts are NEVER suppressed
        # Cold-start WARNINGS can be suppressed by personal baseline
        if (alert["severity"] == "warning" and
                is_suppressed_by_baseline(patient_id, vital, value)):
            suppress[vital] = True
        else:
            alerts.append(alert)

    # ── Layer 2: OC-SVM Anomaly Detection ─────────────────────────────────
    X = np.array([[heart_rate, temperature, spo2, moisture]])
    X_scaled = scaler.transform(X)
    ocsvm_result = model.predict(X_scaled)[0]  # +1 = normal, -1 = anomaly

    if ocsvm_result == -1:
        # Check if ALL flagged vitals are suppressed
        vitals_to_check = {
            "heart_rate" : heart_rate,
            "temperature": temperature,
            "spo2"       : spo2,
        }
        suppressed_all = all(
            is_suppressed_by_baseline(patient_id, v, val)
            for v, val in vitals_to_check.items()
        )
        if not suppressed_all:
            alerts.append({
                "vital"   : "multi_feature",
                "value"   : None,
                "message" : ("OC-SVM detected abnormal pattern — "
                             "multi-feature deviation from baseline"),
                "severity": "warning"
            })

    # ── Final Result ───────────────────────────────────────────────────────
    has_critical = any(a["severity"] == "critical" for a in alerts)
    has_warning  = any(a["severity"] == "warning"  for a in alerts)

    if has_critical:
        status = "CRITICAL"
    elif has_warning:
        status = "WARNING"
    else:
        status = "NORMAL"

    return {
        "patient_id"  : patient_id,
        "status"      : status,
        "alerts"      : alerts,
        "ocsvm_result": "anomaly" if ocsvm_result == -1 else "normal",
        "readings"    : {
            "heart_rate" : heart_rate,
            "temperature": temperature,
            "spo2"       : spo2,
            "moisture"   : moisture
        },
        "timestamp"   : datetime.now().isoformat()
    }


# ══════════════════════════════════════════════════════════════════════════
# TEST SIMULATION — runs when you execute this file directly
# ══════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":

    def print_result(label, result):
        print(f"\n{'─'*55}")
        print(f"  Scenario : {label}")
        print(f"  Patient  : {result['patient_id']}")
        print(f"  Readings : HR={result['readings']['heart_rate']} bpm | "
              f"Temp={result['readings']['temperature']}°C | "
              f"SpO2={result['readings']['spo2']}% | "
              f"Moisture={'Wet' if result['readings']['moisture'] else 'Dry'}")
        print(f"  OC-SVM   : {result['ocsvm_result']}")
        print(f"  STATUS   : {'🚨' if result['status'] == 'CRITICAL' else '⚠️' if result['status'] == 'WARNING' else '✅'} {result['status']}")
        if result["alerts"]:
            for a in result["alerts"]:
                print(f"  → {a['message']}")

    print("══════════════════════════════════════════════════════")
    print("  ALAGA OC-SVM — Live Prediction Simulation")
    print("══════════════════════════════════════════════════════")

    # 1. Normal adult reading
    r = predict("P001", heart_rate=75, temperature=36.8,
                spo2=98, moisture=0, patient_type="adult")
    print_result("Normal adult reading", r)

    # 2. Normal infant reading
    r = predict("P002", heart_rate=130, temperature=37.0,
                spo2=97, moisture=0, patient_type="infant")
    print_result("Normal infant reading", r)

    # 3. Fever detected
    r = predict("P003", heart_rate=88, temperature=39.2,
                spo2=96, moisture=0, patient_type="adult")
    print_result("Adult with fever", r)

    # 4. Hypoxia emergency
    r = predict("P004", heart_rate=95, temperature=36.9,
                spo2=87, moisture=0, patient_type="adult")
    print_result("Low SpO2 (hypoxia)", r)

    # 5. Wet diaper
    r = predict("P005", heart_rate=120, temperature=36.7,
                spo2=98, moisture=1, patient_type="infant")
    print_result("Wet diaper (infant)", r)

    # 6. Tachycardia patient — BEFORE personalization (should alert)
    print(f"\n{'─'*55}")
    print("  Scenario : Tachycardia patient — BEFORE personalization")
    r = predict("P006", heart_rate=132, temperature=36.9,
                spo2=97, moisture=0, patient_type="adult")
    print_result("Tachycardia — alert fires", r)

    # 7. Caregiver flags HR as normal 5 times
    print(f"\n{'─'*55}")
    print("  Caregiver flags HR readings as normal for P006:")
    for i, hr_val in enumerate([132, 128, 135, 130, 133], 1):
        msg = flag_as_normal("P006", "heart_rate", hr_val)
        print(f"  Flag {i}: {msg}")

    # 8. Same patient AFTER personalization (should suppress HR alert)
    r = predict("P006", heart_rate=131, temperature=36.9,
                spo2=97, moisture=0, patient_type="adult")
    print_result("Tachycardia — AFTER personalization (suppressed)", r)

    # 9. Critical scenario overrides personalization
    r = predict("P006", heart_rate=131, temperature=39.5,
                spo2=86, moisture=0, patient_type="adult")
    print_result("Same patient — but now has fever + low SpO2 (never suppressed)", r)

    print(f"\n{'═'*55}")
    print("  Simulation complete. This predict() function is what")
    print("  your backend calls for every sensor reading from ESP32.")
    print(f"{'═'*55}")