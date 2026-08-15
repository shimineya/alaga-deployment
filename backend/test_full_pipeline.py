import requests
import json

SERVER_URL = "https://alaga-backend.onrender.com/api/sensor/reading"
DEVICE_SERIAL = "VS-2026-0001"
DEVICE_TOKEN = "VS-2026-0001"

PAYLOAD = {
    "heart_rate": 150,
    "temperature": 39.5,
    "spo2": 85,
    "moisture": 0
}

print("Sending abnormal vitals to backend...")
print(f"Payload: {json.dumps(PAYLOAD, indent=2)}")

response = requests.post(
    SERVER_URL,
    json=PAYLOAD,
    headers={
        "X-Device-Serial": DEVICE_SERIAL,
        "X-Device-Token": DEVICE_TOKEN,
        "Content-Type": "application/json"
    }
)

print(f"\nStatus Code: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")