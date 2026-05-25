import pandas as pd
import numpy as np
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler
import joblib
import os

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR  = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

TRAIN_CSV   = os.path.join(DATA_DIR, "normal_vitals.csv")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")
MODEL_PATH  = os.path.join(MODEL_DIR, "ocsvm_model.pkl")

# ── Step 1: Load training data ─────────────────────────────────────────────
print("Loading training data...")
df = pd.read_csv(TRAIN_CSV)
features = ["heart_rate", "temperature", "spo2", "moisture"]
X = df[features].values
print(f"Training samples: {len(X):,}")

# ── Step 2: Scale the data ─────────────────────────────────────────────────
print("Loading scaler...")
scaler = joblib.load(SCALER_PATH)
X_scaled = scaler.transform(X)

# ── Step 3: Train OC-SVM ───────────────────────────────────────────────────
# kernel = 'rbf'  → as specified in the ALAGA thesis (RBF kernel)
# nu     = 0.05   → ~5% of training data allowed as outliers
#                   (keeps the boundary tight but not overly strict)
# gamma  = 'scale'→ auto-calculated based on feature variance
print("\nTraining One-Class SVM...")
print("  kernel : rbf")
print("  nu     : 0.05")
print("  gamma  : scale")

model = OneClassSVM(kernel='rbf', nu=0.05, gamma='scale')
model.fit(X_scaled)

print("✅ Model trained successfully!")

# ── Step 4: Quick sanity check on training data ────────────────────────────
# The model should classify most training (normal) data as +1
train_preds = model.predict(X_scaled)
normal_count   = (train_preds == 1).sum()
outlier_count  = (train_preds == -1).sum()
pct_normal     = (normal_count / len(train_preds)) * 100

print(f"\n── Sanity Check on Training Data ──")
print(f"  Classified as NORMAL  (+1): {normal_count:,}  ({pct_normal:.1f}%)")
print(f"  Classified as OUTLIER (-1): {outlier_count:,}  ({100 - pct_normal:.1f}%)")
print(f"  (Expected ~95% normal since nu=0.05)")

# ── Step 5: Save the model ────────────────────────────────────────────────
joblib.dump(model, MODEL_PATH)
print(f"\n✅ Model saved → models/ocsvm_model.pkl")

# ── Step 6: Show support vector info ──────────────────────────────────────
n_sv = model.support_vectors_.shape[0]
print(f"\n── Model Info ──")
print(f"  Support vectors : {n_sv:,}")
print(f"  Decision offset : {model.offset_[0]:.4f}")
print(f"\nDone! Run 03_evaluate_model.py next to test accuracy.")