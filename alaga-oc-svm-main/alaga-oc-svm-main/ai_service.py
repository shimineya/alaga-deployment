"""
ALAGA AI Microservice
----------------------
Internal-only Flask server that loads the trained OC-SVM model and exposes
a /predict endpoint consumed exclusively by the Express backend.

Binding: 127.0.0.1:5001 (NOT exposed to the internet or Flutter app)
[OWASP A02] Internal binding prevents external callers from invoking the AI
            directly without passing through the Express auth + audit layer.

Run with: python ai_service.py
Requirements: flask, flask-cors, scikit-learn, numpy, joblib
"""

from flask import Flask, request, jsonify
import sys
import os
import json
import hashlib
import numpy as np
from datetime import datetime

# ---------------------------------------------------------------------------
# Add scripts folder to path so we can import the predict module
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
scripts_path = os.path.join(BASE_DIR, "scripts")
sys.path.insert(0, scripts_path)

import importlib.util
spec = importlib.util.spec_from_file_location(
    "predict", os.path.join(scripts_path, "04_predict.py")
)
predict_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(predict_module)

predict         = predict_module.predict
flag_as_normal  = predict_module.flag_as_normal
PATIENT_BASELINES = predict_module.PATIENT_BASELINES
FLAG_THRESHOLD  = predict_module.FLAG_THRESHOLD
TOLERANCE       = predict_module.TOLERANCE

# ---------------------------------------------------------------------------
# [OWASP A02] Internal authentication token.
# The Express backend reads this from AI_INTERNAL_TOKEN in .env and sends it
# on every request via the X-Internal-Token header.
# ---------------------------------------------------------------------------
INTERNAL_TOKEN = os.environ.get("AI_INTERNAL_TOKEN", "")

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Internal token guard — applied to every request
# [OWASP A02] Prevents rogue processes on the same machine from hitting the AI
# ---------------------------------------------------------------------------
@app.before_request
def require_internal_token():
    if not INTERNAL_TOKEN:
        # Token not configured — block all requests to force misconfiguration to surface
        return jsonify({"error": "AI service internal token not configured."}), 503

    provided = request.headers.get("X-Internal-Token", "")
    # Constant-time comparison to prevent timing attacks
    if not _safe_compare(provided, INTERNAL_TOKEN):
        return jsonify({"error": "Unauthorized"}), 401


def _safe_compare(a: str, b: str) -> bool:
    """
    Constant-time string comparison.
    [OWASP A04] Prevents timing oracle attacks on the internal token.
    """
    if len(a) != len(b):
        return False
    result = 0
    for x, y in zip(a, b):
        result |= ord(x) ^ ord(y)
    return result == 0


# ===========================================================================
# ENDPOINT 1: Run OC-SVM prediction
# POST /predict
# Called by Express backend for every sensor reading
# ===========================================================================
@app.route("/predict", methods=["POST"])
def run_prediction():
    """
    Accepts a sensor reading and returns the OC-SVM prediction result.

    Request body:
        patient_id   (int)    -- numeric patient ID from PostgreSQL
        heart_rate   (float)  -- bpm
        temperature  (float)  -- degrees Celsius
        spo2         (float)  -- percentage
        moisture     (int)    -- 0 (dry) or 1 (wet)
        patient_type (str)    -- 'infant' or 'adult'
        baseline     (dict)   -- pre-loaded baseline from PostgreSQL (optional)

    Response:
        status        (str)   -- 'NORMAL', 'WARNING', or 'CRITICAL'
        alerts        (list)  -- list of alert objects
        ocsvm_result  (str)   -- 'normal' or 'anomaly'
        timestamp     (str)   -- ISO 8601
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON body received"}), 400

        patient_id   = str(data.get("patient_id", "UNKNOWN"))
        heart_rate   = float(data.get("heart_rate", 0))
        temperature  = float(data.get("temperature", 36.5))
        spo2         = float(data.get("spo2", 97))
        moisture     = int(data.get("moisture", 0))
        patient_type = data.get("patient_type", "adult")

        # Load baseline from PostgreSQL if provided by Express backend.
        # This syncs the in-memory PATIENT_BASELINES dict with what the DB knows,
        # making the adaptive baseline survive service restarts.
        baseline_from_db = data.get("baseline")
        if baseline_from_db and isinstance(baseline_from_db, list):
            _sync_baseline_from_db(patient_id, baseline_from_db)

        result = predict(
            patient_id   = patient_id,
            heart_rate   = heart_rate,
            temperature  = temperature,
            spo2         = spo2,
            moisture     = moisture,
            patient_type = patient_type
        )

        return jsonify({
            "status"      : result["status"],
            "alerts"      : result["alerts"],
            "ocsvm_result": result["ocsvm_result"],
            "timestamp"   : result["timestamp"]
        }), 200

    except (ValueError, TypeError) as e:
        # [OWASP A10] Return generic message — do not expose internal exception detail
        print(f"[AI-SERVICE] Prediction input error: {e}")
        return jsonify({"error": "Invalid input values"}), 400
    except Exception as e:
        print(f"[AI-SERVICE] Prediction error: {e}")
        return jsonify({"error": "Prediction failed"}), 500


# ===========================================================================
# ENDPOINT 2: Sync an adaptive baseline flag from the Express backend
# POST /baseline/flag
# Called when a caregiver taps "Flag as Normal" in the Flutter app
# ===========================================================================
@app.route("/baseline/flag", methods=["POST"])
def flag_baseline():
    """
    Records a caregiver flag and updates the in-memory adaptive baseline.
    The Express backend is responsible for persisting this to PostgreSQL.

    Request body:
        patient_id (int)
        vital      (str)   -- 'heart_rate', 'temperature', or 'spo2'
        value      (float) -- the reading value the caregiver flagged as normal
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON body received"}), 400

        patient_id = str(data.get("patient_id", ""))
        vital      = data.get("vital", "")
        value      = float(data.get("value", 0))

        allowed_vitals = {"heart_rate", "temperature", "spo2"}
        if vital not in allowed_vitals:
            return jsonify({"error": "Invalid vital name"}), 400

        message = flag_as_normal(patient_id, vital, value)

        # Return the updated baseline entry so the Express backend can persist it
        baseline_entry = PATIENT_BASELINES.get(patient_id, {}).get(vital, {})

        return jsonify({
            "message"       : message,
            "vital"         : vital,
            "flag_count"    : baseline_entry.get("flag_count", 0),
            "flagged_values": baseline_entry.get("flagged_values", []),
            "mean_value"    : baseline_entry.get("mean"),
            "upper_bound"   : baseline_entry.get("upper"),
            "lower_bound"   : baseline_entry.get("lower")
        }), 200

    except (ValueError, TypeError) as e:
        print(f"[AI-SERVICE] Flag input error: {e}")
        return jsonify({"error": "Invalid input values"}), 400
    except Exception as e:
        print(f"[AI-SERVICE] Flag error: {e}")
        return jsonify({"error": "Flag operation failed"}), 500


# ===========================================================================
# ENDPOINT 3: Health check (used by Express to verify service is up)
# GET /health
# ===========================================================================
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status"    : "ok",
        "service"   : "alaga-ai",
        "timestamp" : datetime.now().isoformat()
    }), 200


# ---------------------------------------------------------------------------
# Helper: Sync PostgreSQL baseline rows into the in-memory PATIENT_BASELINES
# Called on every /predict request so the baseline is always current.
# ---------------------------------------------------------------------------
def _sync_baseline_from_db(patient_id: str, rows: list):
    """
    Translates a list of patient_baselines DB rows into the PATIENT_BASELINES
    dict format that 04_predict.py understands.

    Each row is expected to be a dict with keys:
        vital_name, flag_count, flagged_values, mean_value, upper_bound, lower_bound
    """
    if patient_id not in PATIENT_BASELINES:
        PATIENT_BASELINES[patient_id] = {}

    for row in rows:
        vital = row.get("vital_name")
        if not vital:
            continue

        PATIENT_BASELINES[patient_id][vital] = {
            "flag_count"    : row.get("flag_count", 0),
            "flagged_values": row.get("flagged_values", []),
            "mean"          : row.get("mean_value"),
            "upper"         : row.get("upper_bound"),
            "lower"         : row.get("lower_bound")
        }


# ===========================================================================
# STARTUP
# ===========================================================================
if __name__ == "__main__":
    if not INTERNAL_TOKEN:
        print("[CRITICAL] AI_INTERNAL_TOKEN environment variable is not set.")
        print("           Set it in .env and restart. The service will reject all requests.")
        print("           Example: AI_INTERNAL_TOKEN=<256-bit-hex-string>")

    print("=" * 55)
    print("  ALAGA AI Microservice Starting")
    print("=" * 55)
    print("  Binding  : 127.0.0.1:5001 (internal only)")
    print("  Endpoints:")
    print("    POST /predict         <- Express calls for each reading")
    print("    POST /baseline/flag   <- Express calls on caregiver flag")
    print("    GET  /health          <- Express health check")
    print("=" * 55)

    # [OWASP A02] Bind to loopback only — NOT 0.0.0.0
    # debug=False in all environments — never expose debug mode
    app.run(host="127.0.0.1", port=5001, debug=False)
