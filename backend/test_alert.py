import subprocess
import json

# Abnormal vitals to trigger an alert
payload = json.dumps({
    "action": "predict",
    "patient_id": "TEST",
    "heart_rate": 150,
    "temperature": 39.5,
    "spo2": 85,
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