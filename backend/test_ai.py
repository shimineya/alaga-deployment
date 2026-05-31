import subprocess
import json
 
payload = json.dumps({
    "action": "predict",
    "patient_id": "TEST",
    "heart_rate": 75,
    "temperature": 36.5,
    "spo2": 98,
    "moisture": 0,
    "patient_type": "adult"
})
 
result = subprocess.run(
    ["python", "alaga_predict.py", payload],
    capture_output=True,
    text=True
)
 
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)