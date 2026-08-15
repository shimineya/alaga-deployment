import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR    = os.path.join(BASE_DIR, "data")
MODEL_DIR   = os.path.join(BASE_DIR, "models")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

TRAIN_CSV   = os.path.join(DATA_DIR, "normal_vitals.csv")
TEST_CSV    = os.path.join(DATA_DIR, "test_vitals.csv")
MODEL_PATH  = os.path.join(MODEL_DIR, "ocsvm_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")

# ── Load model and scaler ──────────────────────────────────────────────────
print("Loading model and scaler...")
model  = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)
features = ["heart_rate", "temperature", "spo2", "moisture"]

# ── PART 1: Test on HIGH RISK (anomaly) data ───────────────────────────────
print("\n── PART 1: Anomaly Detection on High Risk Test Data ──")
df_test = pd.read_csv(TEST_CSV)
X_test  = df_test[features].values
X_test_scaled = scaler.transform(X_test)

preds = model.predict(X_test_scaled)
# OC-SVM: +1 = normal, -1 = anomaly
detected   = (preds == -1).sum()
missed     = (preds ==  1).sum()
total      = len(preds)
detection_rate = (detected / total) * 100

print(f"  Total anomaly samples tested : {total:,}")
print(f"  Correctly flagged as ANOMALY : {detected:,}  ({detection_rate:.1f}%)")
print(f"  Missed (classified as normal): {missed:,}  ({100 - detection_rate:.1f}%)")

# ── PART 2: Cold-Start Safety Floor Check ─────────────────────────────────
print("\n── PART 2: Cold-Start Safety Floor Verification ──")
print("  (These ALWAYS alert regardless of OC-SVM result)")

def cold_start_alert(row):
    alerts = []
    if row["spo2"] < 90:
        alerts.append(f"CRITICAL SpO2: {row['spo2']:.1f}%")
    if row["temperature"] > 38.0:
        alerts.append(f"FEVER: {row['temperature']:.1f}°C")
    if row["heart_rate"] > 160:
        alerts.append(f"HIGH HR (infant threshold): {row['heart_rate']:.0f} bpm")
    if row["moisture"] == 1:
        alerts.append("WET DIAPER detected")
    return alerts

# Test with clear emergency scenarios
test_cases = pd.DataFrame({
    "heart_rate" : [180,  75,   72,   88,   165],
    "temperature": [36.8, 39.5, 36.5, 36.9, 37.1],
    "spo2"       : [98,   97,   88,   97,   96],
    "moisture"   : [0,    0,    0,    1,    0],
    "scenario"   : [
        "Infant tachycardia (HR 180)",
        "Adult fever (Temp 39.5°C)",
        "Low oxygen (SpO2 88%)",
        "Wet diaper",
        "Infant HR borderline (165)"
    ]
})

print()
for _, row in test_cases.iterrows():
    alerts = cold_start_alert(row)
    status = "🚨 ALERT" if alerts else "✅ Normal"
    print(f"  {status} | {row['scenario']}")
    for a in alerts:
        print(f"           → {a}")

# ── PART 3: Simulate the ADAPTIVE BASELINE (flagging) ─────────────────────
print("\n── PART 3: Adaptive Baseline Simulation ──")
print("  Scenario: Patient with Tachycardia (naturally high HR ~130 bpm)")
print()

FLAG_THRESHOLD = 5
patient_flags  = {"heart_rate": 0}
patient_custom = {"heart_rate": None}  # None = not yet personalized

readings = [130, 128, 133, 131, 129]   # 5 caregiver-flagged readings
print(f"  Caregiver flags HR readings as normal for this patient:")
for i, hr in enumerate(readings, 1):
    patient_flags["heart_rate"] += 1
    print(f"    Flag {i}/5 → HR={hr} bpm flagged as normal")
    if patient_flags["heart_rate"] >= FLAG_THRESHOLD:
        avg_hr = np.mean(readings[:i])
        patient_custom["heart_rate"] = {
            "mean": round(avg_hr, 1),
            "upper": round(avg_hr + 10, 1),   # ±10 bpm tolerance
            "lower": round(avg_hr - 10, 1)
        }
        print(f"\n  ✅ FLAG THRESHOLD REACHED after {i} flags!")
        print(f"     Personal HR baseline set:")
        print(f"       Mean  : {patient_custom['heart_rate']['mean']} bpm")
        print(f"       Range : {patient_custom['heart_rate']['lower']} – {patient_custom['heart_rate']['upper']} bpm")
        print(f"     → HR alerts suppressed for this patient within this range")
        break

# ── PART 4: Confusion Matrix ───────────────────────────────────────────────
print("\n── PART 4: Generating Confusion Matrix ──")

# Sample 500 normal rows for comparison
df_normal = pd.read_csv(TRAIN_CSV).sample(500, random_state=42)
X_normal_scaled = scaler.transform(df_normal[features].values)
normal_preds = model.predict(X_normal_scaled)

y_true = [0] * 500 + [1] * len(preds)          # 0=normal, 1=anomaly
y_pred = list((normal_preds == -1).astype(int)) + list((preds == -1).astype(int))

cm = confusion_matrix(y_true, y_pred)
fig, ax = plt.subplots(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=["Predicted Normal", "Predicted Anomaly"],
            yticklabels=["Actual Normal", "Actual Anomaly"], ax=ax)
ax.set_title("ALAGA OC-SVM — Confusion Matrix", fontsize=13, fontweight='bold')
ax.set_ylabel("Actual", fontsize=11)
ax.set_xlabel("Predicted", fontsize=11)
plt.tight_layout()
cm_path = os.path.join(RESULTS_DIR, "confusion_matrix.png")
plt.savefig(cm_path, dpi=150)
print(f"  ✅ Saved → results/confusion_matrix.png")

# ── Summary ────────────────────────────────────────────────────────────────
print("\n══════════════════════════════════════════")
print("  ALAGA OC-SVM EVALUATION SUMMARY")
print("══════════════════════════════════════════")
print(f"  Anomaly Detection Rate : {detection_rate:.1f}%")
print(f"  Cold-Start Rules       : Active (SpO2<90, Temp>38, HR>160, Wet)")
print(f"  Adaptive Baseline      : 5-flag threshold per vital per patient")
print(f"  Model file             : models/ocsvm_model.pkl")
print(f"  Scaler file            : models/scaler.pkl")
print("══════════════════════════════════════════")
print("\nAll done! Run 04_predict.py next to test live predictions.")