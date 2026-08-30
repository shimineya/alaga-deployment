import sys
import json
import os
import importlib.util

# ── Resolve path to 04_predict.py dynamically ──────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
POSSIBLE_PATHS = [
    os.path.join(BASE_DIR, '..', 'alaga-oc-svm-main', 'alaga-oc-svm-main', 'inference_service'),
    os.path.join(BASE_DIR, '..', 'alaga-oc-svm-main', 'inference_service'),
    os.path.join(BASE_DIR, '..', 'alaga-oc-svm-main', 'alaga-oc-svm-main', 'scripts'),
    os.path.join(BASE_DIR, '..', 'alaga-oc-svm-main', 'scripts'),
    os.path.join(BASE_DIR, 'inference_service'),
]

predict_dir = None
for p in POSSIBLE_PATHS:
    if os.path.isfile(os.path.join(p, '04_predict.py')):
        predict_dir = os.path.abspath(p)
        break

if not predict_dir:
    raise FileNotFoundError(f"Could not locate 04_predict.py in any of: {POSSIBLE_PATHS}")

sys.path.insert(0, predict_dir)

# ── Load predict module ────────────────────────────────────────────────────
predict_file = os.path.join(predict_dir, "04_predict.py")
spec = importlib.util.spec_from_file_location("predict_module", predict_file)
predict_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(predict_module)

predict = predict_module.predict
flag_as_normal = predict_module.flag_as_normal

# ── Read input from Node.js ────────────────────────────────────────────────
try:
    input_str = sys.argv[1] if len(sys.argv) > 1 else "{}"
    input_data = json.loads(input_str)
    action = input_data.get('action', 'predict')

    if action == 'predict':
        result = predict(
            patient_id=str(input_data.get('patient_id', 'P001')),
            heart_rate=float(input_data.get('heart_rate', 0)),
            temperature=float(input_data.get('temperature', 36.5)),
            spo2=float(input_data.get('spo2', 97)),
            moisture=int(input_data.get('moisture', 0)),
            patient_type=input_data.get('patient_type', 'adult')
        )
        print(json.dumps({
            "success": True,
            "status": result.get('status', 'NORMAL'),
            "alerts": result.get('alerts', []),
            "ocsvm_result": result.get('ocsvm_result', 'normal'),
            "patient_id": result.get('patient_id'),
            "readings": result.get('readings', {}),
            "timestamp": result.get('timestamp')
        }))

    elif action == 'flag':
        msg = flag_as_normal(
            str(input_data.get('patient_id')),
            input_data.get('vital'),
            float(input_data.get('value'))
        )
        print(json.dumps({
            "success": True,
            "message": msg
        }))

    else:
        print(json.dumps({"success": False, "error": f"Unknown action: {action}"}))

except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
