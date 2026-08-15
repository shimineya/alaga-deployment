import sys
import json
import os
import importlib.util

# ── Path to the cloned alaga-oc-svm repo ──────────────────────────────────
REPO_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', 'alaga-oc-svm-main', 'alaga-oc-svm-main'
)
SCRIPTS_PATH = os.path.join(REPO_PATH, 'scripts')

sys.path.insert(0, SCRIPTS_PATH)

# ── Load predict module ────────────────────────────────────────────────────
spec = importlib.util.spec_from_file_location(
    "predict", os.path.join(SCRIPTS_PATH, "04_predict.py"))
predict_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(predict_module)

predict = predict_module.predict
flag_as_normal = predict_module.flag_as_normal

# ── Read input from Node.js ────────────────────────────────────────────────
try:
    input_data = json.loads(sys.argv[1])
    action = input_data.get('action', 'predict')

    if action == 'predict':
        result = predict(
            patient_id=input_data.get('patient_id', 'P001'),
            heart_rate=float(input_data.get('heart_rate', 0)),
            temperature=float(input_data.get('temperature', 36.5)),
            spo2=float(input_data.get('spo2', 97)),
            moisture=int(input_data.get('moisture', 0)),
            patient_type=input_data.get('patient_type', 'adult')
        )
        print(json.dumps({
            "success": True,
            "status": result['status'],
            "alerts": result['alerts'],
            "ocsvm_result": result['ocsvm_result'],
            "patient_id": result['patient_id']
        }))

    elif action == 'flag':
        msg = flag_as_normal(
            input_data.get('patient_id'),
            input_data.get('vital'),
            float(input_data.get('value'))
        )
        print(json.dumps({
            "success": True,
            "message": msg
        }))

    else:
        print(json.dumps({"success": False, "error": "Unknown action"}))

except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
