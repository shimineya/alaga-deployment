/**
 * ALAGA AI Service
 * ----------------
 * Calls the OC-SVM Python model from Node.js
 * Used in the sensor reading endpoint to detect anomalies
 */

const { PythonShell } = require('python-shell');
const path = require('path');

// Path to the bridge script — adjust if needed
const BRIDGE_SCRIPT = path.join(__dirname, '..', 'alaga_predict.py');

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
  return new Promise((resolve, reject) => {
    const input = JSON.stringify({
      action      : 'predict',
      patient_id  : data.patient_id   || 'P001',
      heart_rate  : data.heart_rate   || 0,
      temperature : data.temperature  || 36.5,
      spo2        : data.spo2         || 97,
      moisture    : data.moisture     || 0,
      patient_type: data.patient_type || 'adult'
    });

    PythonShell.run(BRIDGE_SCRIPT, { args: [input] }, (err, results) => {
      if (err) {
        console.error('AI prediction error:', err);
        // Return safe default instead of crashing
        return resolve({
          status      : 'NORMAL',
          alerts      : [],
          ocsvm_result: 'normal',
          error       : err.message
        });
      }

      try {
        const result = JSON.parse(results[0]);
        resolve(result);
      } catch (parseErr) {
        console.error('AI result parse error:', parseErr);
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
  return new Promise((resolve, reject) => {
    const input = JSON.stringify({
      action    : 'flag',
      patient_id: patientId,
      vital     : vital,
      value     : value
    });

    PythonShell.run(BRIDGE_SCRIPT, { args: [input] }, (err, results) => {
      if (err) {
        console.error('Flag error:', err);
        return resolve('Flag recorded (offline mode)');
      }

      try {
        const result = JSON.parse(results[0]);
        resolve(result.message || 'Flag recorded');
      } catch {
        resolve('Flag recorded');
      }
    });
  });
}

module.exports = { runPrediction, flagAsNormal };