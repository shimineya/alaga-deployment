import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import joblib
import os

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR   = os.path.join(BASE_DIR, "data")
MODEL_DIR  = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

VITAL_CSV  = os.path.join(DATA_DIR, "human_vital_signs_dataset_2024.csv")
IOT_CSV    = os.path.join(DATA_DIR, "Multi-Sensor_Medical_IoT_Dataset.csv")
OUTPUT_CSV = os.path.join(DATA_DIR, "normal_vitals.csv")
TEST_CSV   = os.path.join(DATA_DIR, "test_vitals.csv")

# ── Step 1: Load datasets ──────────────────────────────────────────────────
print("Loading datasets...")
df_vital = pd.read_csv(VITAL_CSV)
df_iot   = pd.read_csv(IOT_CSV)

# ── Step 2: Extract relevant columns ──────────────────────────────────────
# From human vital signs dataset
df_vital_clean = df_vital.rename(columns={
    "Heart Rate"        : "heart_rate",
    "Body Temperature"  : "temperature",
    "Oxygen Saturation" : "spo2",
    "Risk Category"     : "label"
})[["heart_rate", "temperature", "spo2", "label"]]

# From IoT dataset — no label column, treat all as normal (activity-based)
df_iot_clean = df_iot.rename(columns={
    "heart_rate"      : "heart_rate",
    "body_temperature": "temperature",
    "spo2_level"      : "spo2"
})[["heart_rate", "temperature", "spo2"]]
df_iot_clean["label"] = "Low Risk"

# ── Step 3: Combine ────────────────────────────────────────────────────────
df_all = pd.concat([df_vital_clean, df_iot_clean], ignore_index=True)
print(f"Combined dataset: {len(df_all):,} rows")

# ── Step 4: Add synthetic INFANT normal readings ───────────────────────────
# Real clinical ranges: HR 100-160 bpm, Temp 36.5-37.5°C, SpO2 95-100%
print("Generating synthetic infant normal readings...")
np.random.seed(42)
n_infants = 5000

infant_data = pd.DataFrame({
    "heart_rate" : np.random.randint(100, 161, n_infants).astype(float),
    "temperature": np.round(np.random.uniform(36.5, 37.5, n_infants), 2),
    "spo2"       : np.round(np.random.uniform(95.0, 100.0, n_infants), 2),
    "label"      : "Low Risk"
})
df_all = pd.concat([df_all, infant_data], ignore_index=True)
print(f"After adding infant data: {len(df_all):,} rows")

# ── Step 5: Add synthetic MOISTURE column ─────────────────────────────────
# Normal = 0 (dry). Wet events are anomalies — added only in test set.
df_all["moisture"] = 0.0

# ── Step 6: Drop nulls ────────────────────────────────────────────────────
df_all.dropna(subset=["heart_rate", "temperature", "spo2"], inplace=True)

# ── Step 7: Split normal vs anomaly ───────────────────────────────────────
df_normal   = df_all[df_all["label"] == "Low Risk"].copy()
df_abnormal = df_all[df_all["label"] == "High Risk"].copy()

print(f"\nNormal (Low Risk) rows  : {len(df_normal):,}  → used for TRAINING")
print(f"Abnormal (High Risk) rows: {len(df_abnormal):,} → used for TESTING")

# ── Step 8: Add anomaly test cases ────────────────────────────────────────
# These simulate real emergencies the model must catch
print("\nAdding synthetic anomaly test cases...")
anomalies = pd.DataFrame({
    "heart_rate" : [180, 170, 45,  50,  160, 155, 130, 140],
    "temperature": [39.5, 40.0, 35.0, 34.5, 38.5, 39.0, 38.2, 38.8],
    "spo2"       : [84,  82,   88,   86,   89,   87,   83,   85],
    "moisture"   : [1,   0,    0,    1,    0,    1,    0,    1],
    "label"      : ["High Risk"] * 8
})
df_abnormal = pd.concat([df_abnormal, anomalies], ignore_index=True)
df_abnormal["moisture"] = df_abnormal["moisture"].fillna(0.0)

# ── Step 9: Save training and test CSVs ───────────────────────────────────
features = ["heart_rate", "temperature", "spo2", "moisture"]

df_normal[features + ["label"]].to_csv(OUTPUT_CSV, index=False)
df_abnormal[features + ["label"]].to_csv(TEST_CSV, index=False)

print(f"\n✅ Training data saved → data/normal_vitals.csv  ({len(df_normal):,} rows)")
print(f"✅ Test data saved     → data/test_vitals.csv    ({len(df_abnormal):,} rows)")

# ── Step 10: Fit and save the scaler ──────────────────────────────────────
print("\nFitting scaler on normal training data...")
X_normal = df_normal[features].values
scaler = StandardScaler()
scaler.fit(X_normal)

joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.pkl"))
print("✅ Scaler saved → models/scaler.pkl")

# ── Summary ────────────────────────────────────────────────────────────────
print("\n── Feature ranges in TRAINING data ──")
print(df_normal[features].describe().round(2))