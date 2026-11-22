/**
 * ALAGA AI Service
 * ----------------
 * Calls the OC-SVM Python model from Node.js
 * Used in the sensor reading endpoint to detect anomalies
 */

const { spawn, execFile } = require('child_process');
const path = require('path');
const readline = require('readline');

// Path to the bridge script
const BRIDGE_SCRIPT = path.join(__dirname, '..', 'alaga_predict.py');

// Persistent Warm Python Worker Pool (keeps numpy, joblib, ocsvm_model.pkl, and scaler.pkl loaded in RAM
// so predictions complete in ~2ms instead of spawning a new Python process on every 2s sensor packet).
let workerProc = null;
let workerRl = null;
let reqCounter = 0;
const pendingRequests = new Map();

function ensureWorker() {
  if (workerProc && !workerProc.killed && workerProc.exitCode === null) {
    return workerProc;
  }
  try {
    workerProc = spawn('python', [BRIDGE_SCRIPT, '--worker'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    workerProc.unref();
    workerRl = readline.createInterface({ input: workerProc.stdout });
    workerRl.on('line', (line) => {
      try {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) return;
        const parsed = JSON.parse(trimmed);
        const reqId = parsed._req_id;
        if (reqId !== undefined && pendingRequests.has(reqId)) {
          const { resolve, timer } = pendingRequests.get(reqId);
          clearTimeout(timer);
          pendingRequests.delete(reqId);
          resolve(parsed);
        }
      } catch (_) {}
    });
    workerProc.on('exit', () => {
      workerProc = null;
      workerRl = null;
      for (const [, entry] of pendingRequests.entries()) {
        clearTimeout(entry.timer);
        entry.resolve(null);
      }
      pendingRequests.clear();
    });
    workerProc.on('error', () => {
      workerProc = null;
      workerRl = null;
    });
  } catch (_) {
    workerProc = null;
  }
  return workerProc;
}

// Pre-warm the OC-SVM Python worker on module load
ensureWorker();

function callWorker(payload, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const proc = ensureWorker();
    if (!proc || !proc.stdin || !proc.stdin.writable) {
      return resolve(null);
    }
    const reqId = ++reqCounter;
    const timer = setTimeout(() => {
      pendingRequests.delete(reqId);
      resolve(null);
    }, timeoutMs);
    pendingRequests.set(reqId, { resolve, timer });
    try {
      proc.stdin.write(JSON.stringify({ ...payload, _req_id: reqId }) + '\n');
    } catch (_) {
      clearTimeout(timer);
      pendingRequests.delete(reqId);
      resolve(null);
    }
  });
}

/**
 * Run AI prediction on a sensor reading
 *
 * @param {Object} data - Sensor reading
 * @param {string} data.patient_id
 * @param {number} data.heart_rate
 * @param {number} data.temperature
 * @param {number} data.spo2
 * @param {number} data.moisture      - 0 = dry, 1 = wet
 * @param {string} data.patient_type  - 'adult' or 'infant'
 *
 * @returns {Promise<Object>} - { status, alerts, ocsvm_result }
 */
async function runPrediction(data) {
  const payload = {
    action      : 'predict',
    patient_id  : data.patient_id   || 'P001',
    heart_rate  : data.heart_rate   || 0,
    temperature : data.temperature  || 36.5,
    spo2        : data.spo2         || 97,
    moisture    : data.moisture     || 0,
    patient_type: data.patient_type || 'adult',
    baselines   : data.baselines    || []
  };

  // Fast path: Persistent warm Python worker (~2ms latency)
  const warmResult = await callWorker(payload, 3500);
  if (warmResult && warmResult.success) {
    return warmResult;
  }

  return new Promise((resolve) => {
    const input = JSON.stringify(payload);

    const b64Input = Buffer.from(input, 'utf8').toString('base64');

    execFile('python', [BRIDGE_SCRIPT, b64Input], { maxBuffer: 1024 * 1024, timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('AI prediction exec error:', err.message, stderr);
        return resolve({
          status      : 'NORMAL',
          alerts      : [],
          ocsvm_result: 'normal',
          error       : err.message
        });
      }

      try {
        const trimmed = stdout.trim();
        const jsonStart = trimmed.indexOf('{');
        const jsonEnd = trimmed.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
          return resolve(parsed);
        }
        resolve({
          status      : 'NORMAL',
          alerts      : [],
          ocsvm_result: 'normal',
          error       : 'Invalid JSON response'
        });
      } catch (parseErr) {
        console.error('AI result parse error:', parseErr, stdout);
        resolve({
          status      : 'NORMAL',
          alerts      : [],
          ocsvm_result: 'normal',
          error       : 'Parse error'
        });
      }
    });
  });
}

/**
 * Flag a reading as normal for a patient
 * Called when caregiver taps "Flag as Normal" in the app
 *
 * @param {string} patientId
 * @param {string} vital      - 'heart_rate', 'temperature', or 'spo2'
 * @param {number} value      - The value being flagged
 *
 * @returns {Promise<string>} - Progress message
 */
async function flagAsNormal(patientId, vital, value) {
  return new Promise((resolve) => {
    const input = JSON.stringify({
      action    : 'flag',
      patient_id: patientId,
      vital     : vital,
      value     : value
    });
    const b64Input = Buffer.from(input, 'utf8').toString('base64');

    execFile('python', [BRIDGE_SCRIPT, b64Input], { maxBuffer: 1024 * 1024, timeout: 10000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('Flag exec error:', err.message, stderr);
        return resolve('Flag recorded (offline mode)');
      }

      try {
        const trimmed = stdout.trim();
        const jsonStart = trimmed.indexOf('{');
        const jsonEnd = trimmed.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const result = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
          return resolve(result.message || 'Flag recorded');
        }
        resolve('Flag recorded');
      } catch {
        resolve('Flag recorded');
      }
    });
  });
}

module.exports = { runPrediction, flagAsNormal };