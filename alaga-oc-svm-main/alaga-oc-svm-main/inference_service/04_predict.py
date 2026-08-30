import numpy as np
import joblib
import os
from datetime import datetime, timedelta

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR   = os.path.join(BASE_DIR, "model")
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
    "spo2_critical"      : 90.0,   # SpO2 below this = hypoxia emergency
    "spo2_warning"       : 94.0,   # SpO2 below this = warning (not yet critical)
    "temp_fever_infant"  : 37.5,   # Axillary/skin-contact reading, infant <2mo
    "temp_fever_adult"   : 38.0,   # Adult, core/rectal-equivalent reading
    "temp_hypothermia"   : 35.0,   # Temp below this = hypothermia (both types)
    "hr_high_infant"     : 160,    # HR above this = infant tachycardia
    "hr_high_adult"      : 100,    # HR above this = adult tachycardia
    "hr_low_infant"      : 100,    # HR below this = infant bradycardia (NRP guideline)
    "hr_low_adult"       : 50,     # HR below this = adult bradycardia
}

# ══════════════════════════════════════════════════════════════════════════
# ILLNESS MAP
# Curated, non-exhaustive lists per alert type — for caregiver awareness only,
# NOT a diagnosis. Shown in the expandable detail card.
# ══════════════════════════════════════════════════════════════════════════
ILLNESS_MAP = {
    "heart_rate_high": [
        "Fever-related sinus tachycardia",
        "Anemia",
        "Hyperthyroidism",
        "Supraventricular tachycardia (SVT)",
    ],
    "heart_rate_low": [
        "Hypothermia",
        "Medication effect (e.g. beta blockers)",
        "Infection",
        "Sinus node dysfunction",
    ],
    "temperature_high": [
        "Infection",
        "Inflammatory response",
    ],
    "temperature_low": [
        "Hypothermia",
        "Prolonged cold exposure",
    ],
    "urination_frequent": [
        "Urinary tract infection (UTI)",
        "Diabetes mellitus",
        "Diabetes insipidus",
        "Overactive bladder",
    ],
    "urination_prolonged_absence": [
        "Dehydration",
        "Catheter blockage or displacement",
        "Acute kidney injury",
        "Urinary tract obstruction",
    ],
}


def build_alert_detail(vital_key, message):
    """
    Builds the caregiver-facing expandable text block:
    "The patient suffered from X. The patient might be suffering
    from these illnesses: ... Please consider seeing a doctor."
    Returns None for illness list if vital_key has no mapping
    (e.g. moisture, multi_feature).
    """
    illnesses = ILLNESS_MAP.get(vital_key)
    detail = {
        "summary": f"The patient suffered from {message}",
        "illnesses": illnesses if illnesses else [],
        "recommendation": "Please consider seeing a doctor." if illnesses else None,
    }
    return detail


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

# ══════════════════════════════════════════════════════════════════════════
# URINATION EVENT TRACKING
# Tracks wet-diaper timestamps per patient to detect frequency patterns,
# not just single wet/dry state. In production this also lives in the DB.
# Structure: { patient_id: [timestamp, timestamp, ...] }
# ══════════════════════════════════════════════════════════════════════════
URINATION_EVENTS = {}

# Debounce: don't log a new "event" if the sensor is still reading wet
# from the same diaper change (avoids counting one wet diaper as many events)
URINATION_DEBOUNCE_MINUTES = 5

# "Frequent urination" pattern: N+ distinct events within this window
URINATION_FREQUENT_COUNT  = 3
URINATION_FREQUENT_WINDOW_MINUTES = 30

# "Prolonged no urination" — age-differentiated. THESE ARE PLACEHOLDER
# VALUES based on general expected voiding intervals; confirm with a
# clinical adviser before treating as a real threshold.
PROLONGED_NO_URINATION_HOURS = {
    "infant": 4,
    "adult" : 6,
}


def log_urination_event(patient_id, is_wet, timestamp=None):
    """
    Call this whenever a moisture reading comes in. Only records a new
    'event' if enough time has passed since the last one (debounce),
    so a continuously-wet diaper isn't counted as repeated events.
    """
    if not is_wet:
        return
    ts = timestamp or datetime.now()

    if patient_id not in URINATION_EVENTS:
        URINATION_EVENTS[patient_id] = []

    events = URINATION_EVENTS[patient_id]
    if events and (ts - events[-1]) < timedelta(minutes=URINATION_DEBOUNCE_MINUTES):
        return  # still the same event

    events.append(ts)
    # keep only recent history to avoid unbounded growth
    cutoff = ts - timedelta(hours=24)
    URINATION_EVENTS[patient_id] = [e for e in events if e >= cutoff]


def check_urination_pattern(patient_id, patient_type="adult", now=None):
    """
    Returns a list of urination-related alerts based on event history.
    Call this after log_urination_event() on every reading cycle.
    """
    now = now or datetime.now()
    alerts = []
    events = URINATION_EVENTS.get(patient_id, [])

    # ── Frequent urination check ──
    window_start = now - timedelta(minutes=URINATION_FREQUENT_WINDOW_MINUTES)
    recent = [e for e in events if e >= window_start]
    if len(recent) >= URINATION_FREQUENT_COUNT:
        alerts.append({
            "vital"   : "urination_frequent",
            "value"   : len(recent),
            "message" : (f"FREQUENT URINATION: {len(recent)} events in "
                         f"{URINATION_FREQUENT_WINDOW_MINUTES} minutes"),
            "severity": "warning",
        })

    # ── Prolonged no-urination check ──
    threshold_hours = PROLONGED_NO_URINATION_HOURS.get(patient_type, 6)
    if events:
        hours_since_last = (now - events[-1]).total_seconds() / 3600
        if hours_since_last >= threshold_hours:
            alerts.append({
                "vital"   : "urination_prolonged_absence",
                "value"   : round(hours_since_last, 1),
                "message" : (f"NO URINATION for {hours_since_last:.1f}h "
                             f"(threshold: {threshold_hours}h)"),
                "severity": "warning",
            })
    # if there's no event history at all yet, we don't alert —
    # not enough data to say anything meaningful

    return alerts


def check_cold_start(heart_rate, temperature, spo2, moisture,
                     patient_type="adult"):
    """
    Layer 1: Hardcoded clinical safety floors.
    Returns list of alerts. Empty list = no cold-start triggers.
    patient_type: 'infant' or 'adult'
    """
    alerts = []

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

    # Temperature checks (age-differentiated fever threshold)
    fever_threshold = (COLD_START_RULES["temp_fever_infant"]
                        if patient_type == "infant"
                        else COLD_START_RULES["temp_fever_adult"])

    if temperature > fever_threshold:
        alerts.append({
            "vital"    : "temperature_high",
            "value"    : temperature,
            "message"  : f"FEVER detected: {temperature:.1f}°C",
            "severity" : "critical"
        })
    elif temperature < COLD_START_RULES["temp_hypothermia"]:
        alerts.append({
            "vital"    : "temperature_low",
            "value"    : temperature,
            "message"  : f"HYPOTHERMIA risk: {temperature:.1f}°C",
            "severity" : "critical"
        })

    # Heart rate checks (age-differentiated both directions)
    hr_high = (COLD_START_RULES["hr_high_infant"]
               if patient_type == "infant"
               else COLD_START_RULES["hr_high_adult"])
    hr_low  = (COLD_START_RULES["hr_low_infant"]
               if patient_type == "infant"
               else COLD_START_RULES["hr_low_adult"])

    if heart_rate > hr_high:
        alerts.append({
            "vital"    : "heart_rate_high",
            "value"    : heart_rate,
            "message"  : f"HIGH HEART RATE: {heart_rate:.0f} bpm (>{hr_high})",
            "severity" : "warning"
        })
    elif heart_rate < hr_low:
        alerts.append({
            "vital"    : "heart_rate_low",
            "value"    : heart_rate,
            "message"  : (f"EMERGENCY: No pulse detected!" if heart_rate == 0
                          else f"LOW HEART RATE: {heart_rate:.0f} bpm — Bradycardia risk"),
            "severity" : "critical"
        })

    # Moisture check (immediate wet-diaper flag, separate from frequency logic)
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
            patient_type="adult", reading_time=None):
    """
    Main prediction function — called by your backend per sensor reading.

    Parameters:
        patient_id   : str  — unique patient identifier
        heart_rate   : float — bpm
        temperature  : float — °C
        spo2         : float — %
        moisture     : int   — 0 (dry) or 1 (wet)
        patient_type : str  — 'infant' or 'adult'
        reading_time : datetime — optional, defaults to now (useful for tests)

    Returns:
        dict with keys: status, alerts, ocsvm_result, timestamp
        Each alert includes a 'detail' block for the expandable UI card.
    """
    now = reading_time or datetime.now()
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

    # ── Layer 2: Urination pattern tracking ───────────────────────────────
    log_urination_event(patient_id, moisture == 1, timestamp=now)
    urination_alerts = check_urination_pattern(patient_id, patient_type, now=now)
    alerts.extend(urination_alerts)

    # ── Layer 3: OC-SVM Anomaly Detection ─────────────────────────────────
    X = np.array([[heart_rate, temperature, spo2, moisture]])
    X_scaled = scaler.transform(X)
    ocsvm_result = model.predict(X_scaled)[0]  # +1 = normal, -1 = anomaly

    if ocsvm_result == -1:
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

    # ── Attach illness detail to each alert ───────────────────────────────
    for alert in alerts:
        alert["detail"] = build_alert_detail(alert["vital"], alert["message"])

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
        "timestamp"   : now.isoformat()
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
                d = a.get("detail")
                if d and d["illnesses"]:
                    print(f"     Possible causes: {', '.join(d['illnesses'])}")

    print("══════════════════════════════════════════════════════")
    print("  ALAGA OC-SVM — Live Prediction Simulation")
    print("══════════════════════════════════════════════════════")

    r = predict("P001", heart_rate=75, temperature=36.8,
                spo2=98, moisture=0, patient_type="adult")
    print_result("Normal adult reading", r)

    r = predict("P003", heart_rate=88, temperature=39.2,
                spo2=96, moisture=0, patient_type="adult")
    print_result("Adult with fever", r)

    r = predict("P006", heart_rate=45, temperature=36.9,
                spo2=97, moisture=0, patient_type="adult")
    print_result("Bradycardia patient", r)

    # Simulate 3 wet-diaper events within 30 minutes → frequent urination
    print(f"\n{'─'*55}")
    print("  Scenario : Frequent urination (3 events / 30 min)")
    base_time = datetime.now()
    for i, minute_offset in enumerate([0, 10, 20]):
        r = predict("P007", heart_rate=90, temperature=36.8, spo2=97,
                    moisture=1, patient_type="adult",
                    reading_time=base_time + timedelta(minutes=minute_offset))
    print_result("After 3rd wet event in 30 min", r)

    print(f"\n{'═'*55}")
    print("  Simulation complete.")
    print(f"{'═'*55}")