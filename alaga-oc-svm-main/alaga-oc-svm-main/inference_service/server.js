/**
 * ALAGA Node.js Bridge
 * ---------------------
 * Permanent replacement for demo_server.py (Flask).
 * Same 10 endpoints, same JSON shapes Flutter already expects —
 * predictions are computed by calling into your existing Python
 * predict() via pythonBridge.js instead of running Python in-process.
 *
 * Run with: node server.js
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const PredictionBridge = require('./pythonBridge');

// ── Point this at your existing `scripts/` folder (where 04_predict.py,
//    the model files, and predict_bridge.py all live) ──────────────────
const SCRIPTS_PATH = path.join(__dirname, '..', 'scripts');

const app = express();
app.use(cors());
app.use(express.json());

const bridge = new PredictionBridge(SCRIPTS_PATH);

// ── In-memory store (same shape as demo_server.py) ──────────────────────
const latestReadings = {};   // { patient_id: {...} }
const readingHistory = {};   // { patient_id: [...] }
const activeAlerts   = {};   // { patient_id: {...} }
const deviceRemap    = {};   // { "P001": "P005" }

// ── Demo patients (same as demo_server.py) ───────────────────────────────
const DEMO_PATIENTS = {
  P001: { name: 'First Patient',  patient_type: 'adult', is_assignable: true },
  P002: { name: 'Fourth Patient', patient_type: 'adult', is_assignable: false },
  P003: { name: 'Juan Cruz',      patient_type: 'adult', is_assignable: false },
  P004: { name: 'Dad Dada',       patient_type: 'adult', is_assignable: false },
};

function resolvePatientId(patientId) {
  return deviceRemap[patientId] || patientId;
}

function patientName(patientId) {
  return (DEMO_PATIENTS[patientId] && DEMO_PATIENTS[patientId].name) || patientId;
}

function pushHistory(patientId, entry) {
  if (!readingHistory[patientId]) readingHistory[patientId] = [];
  readingHistory[patientId].push(entry);
  readingHistory[patientId] = readingHistory[patientId].slice(-10);
}

function updateActiveAlerts(patientId, result) {
  if (result.alerts && result.alerts.length > 0) {
    activeAlerts[patientId] = {
      patient_id: patientId,
      name: patientName(patientId),
      status: result.status,
      alerts: result.alerts,
      timestamp: new Date().toISOString(),
      dismissed: false,
    };
  } else if (activeAlerts[patientId]) {
    activeAlerts[patientId].dismissed = true;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ENDPOINT 1: ESP32 #1 posts vital signs here
// POST /reading
// ══════════════════════════════════════════════════════════════════════
app.post('/reading', async (req, res) => {
  try {
    let patientId = req.body.patient_id || 'P001';
    let heartRate = parseFloat(req.body.heart_rate || 0);
    let temperature = parseFloat(req.body.temperature ?? 36.5);
    const spo2 = parseFloat(req.body.spo2 ?? 97);
    const patientType = req.body.patient_type || 'adult';

    patientId = resolvePatientId(patientId);

    if (temperature < 0 || temperature > 50) temperature = 36.5;
    if (heartRate <= 0) heartRate = 0;

    const existingMoisture = (latestReadings[patientId] && latestReadings[patientId].moisture) || 0;

    console.log(`\n📥 Vitals from ${patientId}: HR=${heartRate} Temp=${temperature} SpO2=${spo2} Moisture=${existingMoisture}`);

    const result = await bridge.predict({
      patient_id: patientId,
      heart_rate: heartRate,
      temperature,
      spo2,
      moisture: existingMoisture,
      patient_type: patientType,
    });

    console.log(`   AI Status: ${result.status}`);
    (result.alerts || []).forEach((a) => console.log(`   🚨 ${a.message}`));

    latestReadings[patientId] = {
      patient_id: patientId,
      name: patientName(patientId),
      heart_rate: Math.round(heartRate * 10) / 10,
      temperature: Math.round(temperature * 10) / 10,
      spo2: Math.round(spo2 * 10) / 10,
      moisture: existingMoisture,
      status: result.status,
      alerts: result.alerts,
      ocsvm_result: result.ocsvm_result,
      timestamp: new Date().toISOString(),
    };

    pushHistory(patientId, {
      heart_rate: latestReadings[patientId].heart_rate,
      temperature: latestReadings[patientId].temperature,
      spo2: latestReadings[patientId].spo2,
      moisture: existingMoisture,
      status: result.status,
      timestamp: latestReadings[patientId].timestamp,
    });

    updateActiveAlerts(patientId, result);

    res.status(200).json({ success: true, status: result.status, alerts: result.alerts });
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// ENDPOINT 2: ESP32 #2 posts moisture reading here
// POST /moisture
// ══════════════════════════════════════════════════════════════════════
app.post('/moisture', async (req, res) => {
  try {
    let patientId = req.body.patient_id || 'P001';
    const moisture = parseInt(req.body.moisture || 0, 10);
    const percent = parseInt(req.body.percent || 0, 10);

    patientId = resolvePatientId(patientId);

    console.log(`\n💧 Moisture from ${patientId}: ${percent}% (${moisture ? 'WET' : 'DRY'})`);

    if (latestReadings[patientId]) {
      latestReadings[patientId].moisture = moisture;
      const reading = latestReadings[patientId];
      const patientType = (DEMO_PATIENTS[patientId] && DEMO_PATIENTS[patientId].patient_type) || 'adult';

      const result = await bridge.predict({
        patient_id: patientId,
        heart_rate: reading.heart_rate,
        temperature: reading.temperature,
        spo2: reading.spo2,
        moisture,
        patient_type: patientType,
      });

      latestReadings[patientId].status = result.status;
      latestReadings[patientId].alerts = result.alerts;

      console.log(`   AI Status: ${result.status}`);
      (result.alerts || []).forEach((a) => console.log(`   🚨 ${a.message}`));

      updateActiveAlerts(patientId, result);
    } else {
      console.log(`   No vitals yet for ${patientId}, storing moisture only`);
      const wetAlert = {
        vital: 'moisture',
        value: moisture,
        message: 'WET DIAPER detected — Caregiver action needed',
        severity: 'warning',
      };
      latestReadings[patientId] = {
        patient_id: patientId,
        name: patientName(patientId),
        heart_rate: 0,
        temperature: 36.5,
        spo2: 97,
        moisture,
        status: moisture ? 'WARNING' : 'NORMAL',
        alerts: moisture ? [wetAlert] : [],
        ocsvm_result: 'normal',
        timestamp: new Date().toISOString(),
      };
      if (moisture) {
        activeAlerts[patientId] = {
          patient_id: patientId,
          name: patientName(patientId),
          status: 'WARNING',
          alerts: [wetAlert],
          timestamp: new Date().toISOString(),
          dismissed: false,
        };
      }
    }

    res.status(200).json({ success: true, moisture });
  } catch (err) {
    console.error('❌ Moisture error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// ENDPOINT 3: Flutter fetches all patients
// GET /patients
// ══════════════════════════════════════════════════════════════════════
app.get('/patients', (req, res) => {
  const patients = Object.entries(DEMO_PATIENTS).map(([patientId, info]) => {
    const reading = latestReadings[patientId];
    if (reading) {
      return {
        patient_id: patientId,
        name: info.name,
        heart_rate: reading.heart_rate,
        temperature: reading.temperature,
        spo2: reading.spo2,
        moisture: reading.moisture,
        status: reading.status,
        alerts: reading.alerts,
        timestamp: reading.timestamp,
        is_assignable: info.is_assignable || false,
      };
    }
    return {
      patient_id: patientId,
      name: info.name,
      heart_rate: 0,
      temperature: 0,
      spo2: 0,
      moisture: 0,
      status: 'Offline',
      alerts: [],
      timestamp: null,
      is_assignable: info.is_assignable || false,
    };
  });
  res.status(200).json(patients);
});

// ══════════════════════════════════════════════════════════════════════
// ENDPOINT 4: Flutter fetches one patient's reading + history
// GET /patient/:patientId
// ══════════════════════════════════════════════════════════════════════
app.get('/patient/:patientId', (req, res) => {
  const { patientId } = req.params;
  if (!latestReadings[patientId]) {
    return res.status(404).json({ status: 'Offline', message: 'No readings yet' });
  }
  const result = { ...latestReadings[patientId], history: readingHistory[patientId] || [] };
  res.status(200).json(result);
});

// ══════════════════════════════════════════════════════════════════════
// ENDPOINT 5: Flutter fetches active alerts
// GET /alerts
// ══════════════════════════════════════════════════════════════════════
app.get('/alerts', (req, res) => {
  const active = Object.values(activeAlerts).filter((a) => !a.dismissed);
  res.status(200).json(active);
});

// ══════════════════════════════════════════════════════════════════════
// ENDPOINT 6: Caregiver dismisses an alert
// POST /dismiss/:patientId
// ══════════════════════════════════════════════════════════════════════
app.post('/dismiss/:patientId', (req, res) => {
  const { patientId } = req.params;
  if (activeAlerts[patientId]) {
    activeAlerts[patientId].dismissed = true;
    return res.status(200).json({ success: true });
  }
  res.status(404).json({ error: 'No alert found' });
});

// ══════════════════════════════════════════════════════════════════════
// ENDPOINT 7: Caregiver flags a reading as normal
// POST /flag/:patientId
// ══════════════════════════════════════════════════════════════════════
app.post('/flag/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { vital, value } = req.body;
    const result = await bridge.flagAsNormal(patientId, vital, parseFloat(value));
    console.log(`🏳️  Flag: ${result.message}`);
    res.status(200).json({ message: result.message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// ENDPOINT 8: Add new patient
// POST /add_patient
// ══════════════════════════════════════════════════════════════════════
app.post('/add_patient', (req, res) => {
  try {
    const patientId = `P${String(Object.keys(DEMO_PATIENTS).length + 1).padStart(3, '0')}`;
    const firstName = req.body.first_name || '';
    const lastName = req.body.last_name || '';
    const birthdate = req.body.birthdate || '';
    const medicalNotes = req.body.medical_notes || '';
    const patientType = req.body.patient_type || 'adult';
    const name = `${firstName} ${lastName}`.trim();

    DEMO_PATIENTS[patientId] = {
      name,
      patient_type: patientType,
      birthdate,
      medical_notes: medicalNotes,
      is_assignable: true,
    };

    console.log(`\n✅ New patient added: ${name} (${patientId})`);
    res.status(200).json({ success: true, patient_id: patientId, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// ENDPOINT 9: Patients with active readings (for transfer dialog)
// GET /assignable_patients
// ══════════════════════════════════════════════════════════════════════
app.get('/assignable_patients', (req, res) => {
  const active = Object.entries(DEMO_PATIENTS)
    .filter(([patientId]) => {
      const reading = latestReadings[patientId];
      return reading && reading.status !== 'Offline' && reading.heart_rate > 0;
    })
    .map(([patientId, info]) => ({ patient_id: patientId, name: info.name || patientId }));
  res.status(200).json(active);
});

// ══════════════════════════════════════════════════════════════════════
// ENDPOINT 10: Transfer device from one patient to another
// POST /transfer   Body: { "from_patient": "P001", "to_patient": "P005" }
// ══════════════════════════════════════════════════════════════════════
app.post('/transfer', (req, res) => {
  try {
    const { from_patient: fromPatient, to_patient: toPatient } = req.body;
    if (!fromPatient || !toPatient) {
      return res.status(400).json({ error: 'Missing patient IDs' });
    }

    deviceRemap[fromPatient] = toPatient;

    if (latestReadings[fromPatient]) {
      const reading = { ...latestReadings[fromPatient] };
      reading.patient_id = toPatient;
      reading.name = patientName(toPatient);
      latestReadings[toPatient] = reading;

      if (readingHistory[fromPatient]) {
        readingHistory[toPatient] = [...readingHistory[fromPatient]];
      }

      latestReadings[fromPatient] = {
        patient_id: fromPatient,
        name: patientName(fromPatient),
        heart_rate: 0,
        temperature: 0,
        spo2: 0,
        moisture: 0,
        status: 'Offline',
        alerts: [],
        ocsvm_result: 'normal',
        timestamp: null,
      };

      if (activeAlerts[fromPatient]) {
        activeAlerts[fromPatient].dismissed = true;
      }
    }

    console.log(`\n🔄 Device transferred: ${patientName(fromPatient)} → ${patientName(toPatient)}`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Transfer error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════
// STARTUP
// ══════════════════════════════════════════════════════════════════════
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('══════════════════════════════════════════');
  console.log('  ALAGA Node.js Bridge Starting...');
  console.log('══════════════════════════════════════════');
  console.log('  Endpoints:');
  console.log('  POST /reading              ← ESP32 #1 vital signs');
  console.log('  POST /moisture             ← ESP32 #2 diaper moisture');
  console.log('  GET  /patients             ← Flutter all patients');
  console.log('  GET  /patient/:id          ← Flutter one patient');
  console.log('  GET  /alerts               ← Flutter active alerts');
  console.log('  POST /dismiss/:id          ← Dismiss alert');
  console.log('  POST /flag/:id             ← Flag as normal');
  console.log('  POST /add_patient          ← Register new patient');
  console.log('  GET  /assignable_patients  ← Patients with active readings');
  console.log('  POST /transfer             ← Transfer device to patient');
  console.log('══════════════════════════════════════════');
  console.log(`  Listening on port ${PORT}`);
  console.log('══════════════════════════════════════════\n');
});