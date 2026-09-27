/**
 * ============================================================================
 * ALAGA HEALTHCARE MONITORING SYSTEM
 * CLINICAL RULE-BASED ANOMALY DETECTION ENGINE
 * ============================================================================
 *
 * PURPOSE:
 * Provides a high-reliability, clinically-validated rule engine that runs
 * directly in Node.js independent of external Python subprocesses or ML models.
 *
 * Catches critical physiological anomalies that machine learning (OC-SVM) models
 * cannot or fail to detect:
 *   1. Acute Temporal Deltas / Velocity of Change (rapid HR spike/crash, SpO2 plunge, sudden fever)
 *   2. Syndromic Multi-Vital Cross-Correlations (SIRS/Early Sepsis, Cardiorespiratory collapse)
 *   3. Critical Clinical Boundary Safeguards (WHO/NRP Hypoxia, Bradycardia, Hypothermia, Hyperpyrexia)
 *   4. Prolonged Moisture Exposure (unattended wet diaper leading to ulcer/dermatitis risk)
 *   5. Sensor Flatlining / Asystole / Sensor Detachment (zero pulse, unphysiological values)
 *   6. Automatic fail-safe when AI model is slow, offline, or returns a false negative.
 * ============================================================================
 */

// ── CLINICAL BOUNDARIES & STATIC SAFETY FLOORS ──────────────────────────────
const CLINICAL_THRESHOLDS = {
    adult: {
        hr_critical_high: 130,   // Severe tachycardia / SVT risk
        hr_warning_high : 100,   // Tachycardia floor
        hr_warning_low  : 50,    // Bradycardia floor
        hr_critical_low : 40,    // Severe bradycardia / heart block
        temp_fever_high : 39.0,  // Hyperpyrexia
        temp_fever_warn : 38.0,  // Fever threshold
        temp_hypo_warn  : 35.8,  // Mild hypothermia
        temp_hypo_crit  : 35.0,  // Severe hypothermia
    },
    infant: {
        hr_critical_high: 180,   // Critical infant tachycardia
        hr_warning_high : 160,   // Infant tachycardia
        hr_warning_low  : 100,   // Infant bradycardia (NRP guideline)
        hr_critical_low : 80,    // Severe infant bradycardia
        temp_fever_high : 38.5,  // High infant fever
        temp_fever_warn : 37.5,  // Axillary/skin fever threshold (<2 mo)
        temp_hypo_warn  : 36.0,  // Infant cold stress
        temp_hypo_crit  : 35.0,  // Critical hypothermia
    },
    universal: {
        spo2_critical   : 90.0,  // Severe Hypoxia (Emergency)
        spo2_warning    : 94.0,  // Hypoxia Warning (Clinical monitor threshold)
        hr_asystole     : 0,     // No pulse detected
        moisture_wet    : 1      // Immediate wet diaper flag
    }
};

// ── TEMPORAL DELTA THRESHOLDS (Velocity of Change) ──────────────────────────
// Acute rate of change between consecutive readings within a 15-minute window
const DELTA_THRESHOLDS = {
    hr_spike_bpm     : 25,   // +25 bpm jump within <= 5 mins (sudden arrhythmia / distress)
    hr_drop_bpm      : 30,   // -30 bpm drop within <= 5 mins (vasovagal / acute decompensation)
    spo2_drop_pct    : 4.0,  // -4% SpO2 plunge within <= 5 mins (acute desaturation)
    temp_rise_deg    : 1.0,  // +1.0°C rise within <= 15 mins (acute septic spike / hyperthermia)
};

// ── ILLNESS REFERENCE MAP (Caregiver Diagnostic Guide) ──────────────────────
const RULE_ILLNESS_MAP = {
    heart_rate_high: [
        "Fever-related sinus tachycardia",
        "Anemia",
        "Hyperthyroidism",
        "Supraventricular tachycardia (SVT)"
    ],
    heart_rate_low: [
        "Hypothermia",
        "Medication effect (e.g. beta blockers)",
        "Sinus node dysfunction",
        "Heart block"
    ],
    temperature_high: [
        "Systemic infection",
        "Inflammatory response",
        "Heat exhaustion / hyperthermia"
    ],
    temperature_low: [
        "Hypothermia",
        "Prolonged environmental cold exposure",
        "Circulatory impairment"
    ],
    spo2_low: [
        "Acute respiratory distress",
        "Airway compromise",
        "Pneumonia or pulmonary aspiration",
        "Hypoventilation"
    ],
    sepsis_risk: [
        "Systemic Inflammatory Response Syndrome (SIRS)",
        "Early bacteremia / Sepsis",
        "Severe occult infection"
    ],
    cardiorespiratory_distress: [
        "Acute pulmonary embolism",
        "Severe asthma / COPD exacerbation",
        "Cardiogenic shock",
        "Circulatory collapse"
    ],
    prolonged_wetness: [
        "Diaper dermatitis (nappy rash)",
        "Pressure ulcer / bed sore development",
        "Secondary fungal / bacterial skin infection"
    ]
};

function buildRuleDetail(category, summaryMessage) {
    const illnesses = RULE_ILLNESS_MAP[category] || [];
    return {
        summary: summaryMessage,
        illnesses: illnesses,
        recommendation: illnesses.length > 0 ? "Please consider immediate clinical assessment." : null
    };
}

/**
 * Checks if a specific vital/anomaly type has been flagged normal 5+ times
 * by the caregiver, meaning it matches an established patient baseline.
 *
 * NOTE: Extreme life-threatening alerts (SpO2 < 85% or HR == 0) are NEVER
 * suppressed, adhering to clinical patient safety standards.
 */
function isBaselineSuppressed(vitalKey, value, baselines, anomalyType) {
    if (!baselines || baselines.length === 0) return false;

    // Safety override: never suppress life-threatening flatlines or severe hypoxia
    if (vitalKey === 'spo2' && value !== null && value < 85) return false;
    if (vitalKey === 'heart_rate' && (value === 0 || value < 35)) return false;

    return baselines.some(b => {
        if ((b.flag_count || 0) < 5) return false;
        const bName = (b.vital_name || '').toLowerCase();
        const vKey = (vitalKey || '').toLowerCase();
        const aType = (anomalyType || '').toLowerCase();

        if (bName === vKey || bName === aType) return true;
        if (aType.startsWith(`rule_${bName}`)) return true;
        if (vKey.startsWith(bName)) return true;

        // If bounds exist, check if value falls within learned range
        if (b.lower_bound !== null && b.upper_bound !== null && value !== null) {
            const num = parseFloat(value);
            if (!isNaN(num) && num >= b.lower_bound && num <= b.upper_bound) {
                return true;
            }
        }
        return false;
    });
}

/**
 * Main Rule Evaluation Engine
 *
 * @param {Object} params
 * @param {number} params.heartRate
 * @param {number} params.temperature
 * @param {number} params.spo2
 * @param {number} params.moisture - 0 (dry) or 1 (wet)
 * @param {string} [params.patientType='adult'] - 'adult' or 'infant'
 * @param {Array}  [params.baselines=[]] - Active patient baselines from DB
 * @param {Array}  [params.recentHistory=[]] - Up to 5 previous readings for temporal delta evaluation
 *
 * @returns {Array<Object>} List of clinical rule anomaly alerts
 */
function evaluateClinicalRules({
    heartRate,
    temperature,
    spo2,
    moisture,
    patientType = 'adult',
    baselines = [],
    recentHistory = []
}) {
    const alerts = [];
    const isAdult = patientType !== 'infant';
    const limits = isAdult ? CLINICAL_THRESHOLDS.adult : CLINICAL_THRESHOLDS.infant;
    const universal = CLINICAL_THRESHOLDS.universal;

    const hr = typeof heartRate === 'number' && !isNaN(heartRate) ? heartRate : null;
    const temp = typeof temperature === 'number' && !isNaN(temperature) ? temperature : null;
    const sp = typeof spo2 === 'number' && !isNaN(spo2) ? spo2 : null;
    const moist = moisture === 1 || moisture === true || moisture >= 35 ? 1 : 0;

    // ────────────────────────────────────────────────────────────────────────
    // RULE SET 1: CRITICAL CLINICAL THRESHOLDS & BOUNDARIES
    // ────────────────────────────────────────────────────────────────────────

    // 1. SpO2 Hypoxia Check
    if (sp !== null) {
        if (sp < universal.spo2_critical) {
            if (!isBaselineSuppressed('spo2', sp, baselines, 'rule_spo2')) {
                alerts.push({
                    vital: 'spo2',
                    anomaly_type: 'rule_spo2',
                    severity: 'critical',
                    value: sp,
                    message: `CRITICAL: SpO2 at ${sp.toFixed(1)}% — Severe Hypoxia Emergency`,
                    detail: buildRuleDetail('spo2_low', `Severe oxygen desaturation (${sp.toFixed(1)}%)`),
                    is_rule_based: true,
                    rule_code: 'R_SPO2_CRITICAL'
                });
            }
        } else if (sp < universal.spo2_warning) {
            if (!isBaselineSuppressed('spo2', sp, baselines, 'rule_spo2')) {
                alerts.push({
                    vital: 'spo2',
                    anomaly_type: 'rule_spo2',
                    severity: 'warning',
                    value: sp,
                    message: `WARNING: SpO2 at ${sp.toFixed(1)}% — Below normal clinical threshold (<94%)`,
                    detail: buildRuleDetail('spo2_low', `Low oxygen saturation (${sp.toFixed(1)}%)`),
                    is_rule_based: true,
                    rule_code: 'R_SPO2_WARNING'
                });
            }
        }
    }

    // 2. Heart Rate Checks (Flatline, Tachycardia, Bradycardia)
    if (hr !== null) {
        if (hr === universal.hr_asystole) {
            alerts.push({
                vital: 'heart_rate',
                anomaly_type: 'rule_heart_rate_flatline',
                severity: 'critical',
                value: 0,
                message: 'EMERGENCY: Pulse reading at 0 bpm — Asystole or detached sensor!',
                detail: buildRuleDetail('heart_rate_low', 'No cardiac pulse detected'),
                is_rule_based: true,
                rule_code: 'R_HR_ASYSTOLE'
            });
        } else if (hr >= limits.hr_critical_high) {
            if (!isBaselineSuppressed('heart_rate', hr, baselines, 'rule_heart_rate')) {
                alerts.push({
                    vital: 'heart_rate',
                    anomaly_type: 'rule_heart_rate_high',
                    severity: 'critical',
                    value: hr,
                    message: `CRITICAL: Severe Tachycardia (${Math.round(hr)} bpm >= ${limits.hr_critical_high})`,
                    detail: buildRuleDetail('heart_rate_high', `Severe tachycardia (${Math.round(hr)} bpm)`),
                    is_rule_based: true,
                    rule_code: 'R_HR_CRITICAL_HIGH'
                });
            }
        } else if (hr > limits.hr_warning_high) {
            if (!isBaselineSuppressed('heart_rate', hr, baselines, 'rule_heart_rate')) {
                alerts.push({
                    vital: 'heart_rate',
                    anomaly_type: 'rule_heart_rate_high',
                    severity: 'warning',
                    value: hr,
                    message: `WARNING: High Heart Rate (${Math.round(hr)} bpm > ${limits.hr_warning_high})`,
                    detail: buildRuleDetail('heart_rate_high', `Elevated heart rate (${Math.round(hr)} bpm)`),
                    is_rule_based: true,
                    rule_code: 'R_HR_WARNING_HIGH'
                });
            }
        } else if (hr <= limits.hr_critical_low) {
            if (!isBaselineSuppressed('heart_rate', hr, baselines, 'rule_heart_rate')) {
                alerts.push({
                    vital: 'heart_rate',
                    anomaly_type: 'rule_heart_rate_low',
                    severity: 'critical',
                    value: hr,
                    message: `CRITICAL: Severe Bradycardia (${Math.round(hr)} bpm <= ${limits.hr_critical_low})`,
                    detail: buildRuleDetail('heart_rate_low', `Critically low pulse rate (${Math.round(hr)} bpm)`),
                    is_rule_based: true,
                    rule_code: 'R_HR_CRITICAL_LOW'
                });
            }
        } else if (hr < limits.hr_warning_low) {
            if (!isBaselineSuppressed('heart_rate', hr, baselines, 'rule_heart_rate')) {
                alerts.push({
                    vital: 'heart_rate',
                    anomaly_type: 'rule_heart_rate_low',
                    severity: 'warning',
                    value: hr,
                    message: `WARNING: Low Heart Rate (${Math.round(hr)} bpm < ${limits.hr_warning_low})`,
                    detail: buildRuleDetail('heart_rate_low', `Sub-normal heart rate (${Math.round(hr)} bpm)`),
                    is_rule_based: true,
                    rule_code: 'R_HR_WARNING_LOW'
                });
            }
        }
    }

    // 3. Body Temperature Checks (Hyperpyrexia, Fever, Hypothermia)
    // Sensor detachment safeguard: ambient room temperature (<= 30.0°C or off-wrist 0 bpm/0% SpO2) is not clinical hypothermia
    const isTempDetached = temp !== null && (temp <= 30.0 || (hr === 0 && (sp === null || sp === 0)));
    if (temp !== null && !isTempDetached) {
        if (temp >= limits.temp_fever_high) {
            if (!isBaselineSuppressed('temperature', temp, baselines, 'rule_temperature')) {
                alerts.push({
                    vital: 'temperature',
                    anomaly_type: 'rule_temperature_high',
                    severity: 'critical',
                    value: temp,
                    message: `CRITICAL: High Fever / Hyperpyrexia (${temp.toFixed(1)}°C >= ${limits.temp_fever_high}°C)`,
                    detail: buildRuleDetail('temperature_high', `Dangerous high fever (${temp.toFixed(1)}°C)`),
                    is_rule_based: true,
                    rule_code: 'R_TEMP_FEVER_CRITICAL'
                });
            }
        } else if (temp >= limits.temp_fever_warn) {
            if (!isBaselineSuppressed('temperature', temp, baselines, 'rule_temperature')) {
                alerts.push({
                    vital: 'temperature',
                    anomaly_type: 'rule_temperature_high',
                    severity: 'warning',
                    value: temp,
                    message: `WARNING: Elevated Temperature / Fever (${temp.toFixed(1)}°C >= ${limits.temp_fever_warn}°C)`,
                    detail: buildRuleDetail('temperature_high', `Fever detected (${temp.toFixed(1)}°C)`),
                    is_rule_based: true,
                    rule_code: 'R_TEMP_FEVER_WARNING'
                });
            }
        } else if (temp <= limits.temp_hypo_crit) {
            if (!isBaselineSuppressed('temperature', temp, baselines, 'rule_temperature')) {
                alerts.push({
                    vital: 'temperature',
                    anomaly_type: 'rule_temperature_low',
                    severity: 'critical',
                    value: temp,
                    message: `CRITICAL: Hypothermia Emergency (${temp.toFixed(1)}°C <= ${limits.temp_hypo_crit}°C)`,
                    detail: buildRuleDetail('temperature_low', `Severe hypothermic state (${temp.toFixed(1)}°C)`),
                    is_rule_based: true,
                    rule_code: 'R_TEMP_HYPO_CRITICAL'
                });
            }
        } else if (temp <= limits.temp_hypo_warn) {
            if (!isBaselineSuppressed('temperature', temp, baselines, 'rule_temperature')) {
                alerts.push({
                    vital: 'temperature',
                    anomaly_type: 'rule_temperature_low',
                    severity: 'warning',
                    value: temp,
                    message: `WARNING: Low Body Temperature (${temp.toFixed(1)}°C <= ${limits.temp_hypo_warn}°C)`,
                    detail: buildRuleDetail('temperature_low', `Sub-normal temperature (${temp.toFixed(1)}°C)`),
                    is_rule_based: true,
                    rule_code: 'R_TEMP_HYPO_WARNING'
                });
            }
        }
    }

    // 4. Moisture Incontinence Event
    if (moist === 1) {
        if (!isBaselineSuppressed('moisture', 1, baselines, 'rule_moisture')) {
            alerts.push({
                vital: 'moisture',
                anomaly_type: 'rule_moisture',
                severity: 'warning',
                value: 1,
                message: 'WET DIAPER detected — Moisture detected on smart diaper sensor',
                detail: buildRuleDetail('prolonged_wetness', 'Diaper moisture event detected'),
                is_rule_based: true,
                rule_code: 'R_MOISTURE_ACTIVE'
            });
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // RULE SET 2: MULTI-VITAL SYNDROMIC CROSS-CORRELATIONS
    // (Anomalies where individual vitals may look borderline, but combined
    //  signal an acute clinical emergency missed by single-point models)
    // ────────────────────────────────────────────────────────────────────────

    // 5. Impending Septic Shock / SIRS (Systemic Inflammatory Response)
    // Clinically: Fever (>38.3°C) or Hypothermia (<36.0°C) WITH Tachycardia
    if (temp !== null && hr !== null && hr > 0) {
        const hasSirsTemp = temp >= 38.3 || temp < 36.0;
        const hasSirsHr   = isAdult ? hr >= 105 : hr >= 165;
        if (hasSirsTemp && hasSirsHr) {
            alerts.push({
                vital: 'multi_vital_sepsis',
                anomaly_type: 'rule_sepsis_risk',
                severity: 'critical',
                value: null,
                message: `CRITICAL: SIRS / Early Sepsis Pattern Detected (Temp: ${temp.toFixed(1)}°C, HR: ${Math.round(hr)} bpm)`,
                detail: buildRuleDetail('sepsis_risk', `Combined elevated temperature (${temp.toFixed(1)}°C) and tachycardia (${Math.round(hr)} bpm)`),
                is_rule_based: true,
                rule_code: 'R_SYNDROME_SEPSIS'
            });
        }
    }

    // 6. Cardiorespiratory Decompensation (Tachycardia + Hypoxia)
    // When the heart is racing to compensate for failing blood oxygenation
    if (hr !== null && sp !== null && hr > 0) {
        const hasTachy = isAdult ? hr >= 110 : hr >= 165;
        const hasHypo  = sp < 93.0;
        if (hasTachy && hasHypo) {
            alerts.push({
                vital: 'multi_vital_cardio_respiratory',
                anomaly_type: 'rule_cardiorespiratory_distress',
                severity: 'critical',
                value: null,
                message: `CRITICAL: Cardiorespiratory Distress (Tachycardia ${Math.round(hr)} bpm paired with SpO2 ${sp.toFixed(1)}%)`,
                detail: buildRuleDetail('cardiorespiratory_distress', `Concurrent hypoxia (${sp.toFixed(1)}%) and tachycardia (${Math.round(hr)} bpm)`),
                is_rule_based: true,
                rule_code: 'R_SYNDROME_CARDIORESP'
            });
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // RULE SET 3: TEMPORAL DELTA / VELOCITY OF CHANGE ANOMALIES
    // (Anomalies caught by comparing against the patient's recent readings)
    // ────────────────────────────────────────────────────────────────────────
    if (recentHistory && recentHistory.length > 0) {
        const prev = recentHistory[0]; // Most recent previous reading
        const now = new Date();
        const prevTime = new Date(prev.recorded_at || prev.timestamp || now);
        const minutesDiff = Math.max(1, (now.getTime() - prevTime.getTime()) / (1000 * 60));

        // Only evaluate deltas if previous reading was within the last 15 minutes
        if (minutesDiff <= 15) {
            const prevHr = parseFloat(prev.heart_rate);
            const prevSp = parseFloat(prev.spo2);
            const prevTemp = parseFloat(prev.temperature);

            // Acute Heart Rate Spike
            if (hr !== null && !isNaN(prevHr) && prevHr > 0 && hr > 0) {
                const deltaHr = hr - prevHr;
                if (deltaHr >= DELTA_THRESHOLDS.hr_spike_bpm && minutesDiff <= 5) {
                    alerts.push({
                        vital: 'heart_rate_velocity',
                        anomaly_type: 'rule_hr_spike',
                        severity: 'warning',
                        value: deltaHr,
                        message: `WARNING: Rapid Heart Rate Spike (+${Math.round(deltaHr)} bpm in ${Math.round(minutesDiff)}m: ${Math.round(prevHr)} ➔ ${Math.round(hr)} bpm)`,
                        detail: buildRuleDetail('heart_rate_high', `Sudden heart rate acceleration (+${Math.round(deltaHr)} bpm)`),
                        is_rule_based: true,
                        rule_code: 'R_DELTA_HR_SPIKE'
                    });
                } else if (deltaHr <= -DELTA_THRESHOLDS.hr_drop_bpm && minutesDiff <= 5 && hr > 0) {
                    alerts.push({
                        vital: 'heart_rate_velocity',
                        anomaly_type: 'rule_hr_drop',
                        severity: 'warning',
                        value: deltaHr,
                        message: `WARNING: Acute Heart Rate Deceleration (${Math.round(deltaHr)} bpm in ${Math.round(minutesDiff)}m: ${Math.round(prevHr)} ➔ ${Math.round(hr)} bpm)`,
                        detail: buildRuleDetail('heart_rate_low', `Sudden heart rate deceleration (${Math.round(deltaHr)} bpm)`),
                        is_rule_based: true,
                        rule_code: 'R_DELTA_HR_DROP'
                    });
                }
            }

            // Rapid Desaturation Drop
            if (sp !== null && !isNaN(prevSp)) {
                const deltaSp = sp - prevSp;
                if (deltaSp <= -DELTA_THRESHOLDS.spo2_drop_pct && minutesDiff <= 5) {
                    alerts.push({
                        vital: 'spo2_velocity',
                        anomaly_type: 'rule_spo2_crash',
                        severity: 'critical',
                        value: deltaSp,
                        message: `CRITICAL: Rapid Desaturation Plunge (${deltaSp.toFixed(1)}% SpO2 in ${Math.round(minutesDiff)}m: ${prevSp.toFixed(1)}% ➔ ${sp.toFixed(1)}%)`,
                        detail: buildRuleDetail('spo2_low', `Sudden drop in oxygen saturation (${deltaSp.toFixed(1)}%)`),
                        is_rule_based: true,
                        rule_code: 'R_DELTA_SPO2_PLUNGE'
                    });
                }
            }

            // Rapid Temperature Rise
            if (temp !== null && !isNaN(prevTemp)) {
                const deltaTemp = temp - prevTemp;
                if (deltaTemp >= DELTA_THRESHOLDS.temp_rise_deg && minutesDiff <= 15) {
                    alerts.push({
                        vital: 'temperature_velocity',
                        anomaly_type: 'rule_temp_spike',
                        severity: 'warning',
                        value: deltaTemp,
                        message: `WARNING: Rapid Temperature Rise (+${deltaTemp.toFixed(1)}°C in ${Math.round(minutesDiff)}m: ${prevTemp.toFixed(1)}°C ➔ ${temp.toFixed(1)}°C)`,
                        detail: buildRuleDetail('temperature_high', `Rapid temperature elevation (+${deltaTemp.toFixed(1)}°C)`),
                        is_rule_based: true,
                        rule_code: 'R_DELTA_TEMP_SPIKE'
                    });
                }
            }
        }

        // 7. Prolonged Moisture Exposure (Diaper remains wet across multiple consecutive readings)
        if (moist === 1 && recentHistory.length >= 2) {
            const consecutiveWet = recentHistory.slice(0, 3).filter(r => {
                const m = r.moisture;
                return m === 1 || m === true || m >= 35;
            });
            if (consecutiveWet.length >= 2) {
                const oldestWet = consecutiveWet[consecutiveWet.length - 1];
                const oldestTime = new Date(oldestWet.recorded_at || oldestWet.timestamp || now);
                const wetMinutes = (now.getTime() - oldestTime.getTime()) / (1000 * 60);

                if (wetMinutes >= 25) {
                    alerts.push({
                        vital: 'prolonged_moisture',
                        anomaly_type: 'rule_prolonged_wetness',
                        severity: 'warning',
                        value: Math.round(wetMinutes),
                        message: `WARNING: Diaper continuously wet for >${Math.round(wetMinutes)} minutes — Caregiver change needed to prevent skin breakdown`,
                        detail: buildRuleDetail('prolonged_wetness', `Prolonged moisture exposure (>30m)`),
                        is_rule_based: true,
                        rule_code: 'R_PROLONGED_WETNESS'
                    });
                }
            }
        }
    }

    return alerts;
}

/**
 * Merges alerts from both the clinical rule engine and the ML model (OC-SVM).
 *
 * Guarantees:
 * - If AI fails / times out, rule alerts are 100% preserved.
 * - Deduplicates alerts so caregivers are not bombarded by duplicate alerts for the same vital.
 * - Preserves the ML multi-vital anomaly alert (`ocsvm_anomaly`).
 * - Upgrades severity if the rule engine flagged an emergency while ML flagged warning.
 *
 * @param {Array<Object>} ruleAlerts - Alerts from evaluateClinicalRules
 * @param {Array<Object>} aiAlerts   - Alerts from runPrediction (Python model)
 * @returns {Array<Object>} Consolidated, deduplicated alerts
 */
function mergeRuleAndAiAlerts(ruleAlerts = [], aiAlerts = []) {
    const combined = [...ruleAlerts];

    for (const aiAlert of aiAlerts) {
        if (!aiAlert) continue;
        const aiVital = aiAlert.vital;

        // OC-SVM multi-feature anomaly is unique to the ML model — preserve it
        if (aiVital === 'multi_feature') {
            combined.push({
                vital: 'multi_feature',
                anomaly_type: 'ocsvm_anomaly',
                severity: aiAlert.severity || 'warning',
                value: aiAlert.value || null,
                message: aiAlert.message || 'OC-SVM detected abnormal multi-vital pattern',
                detail: aiAlert.detail || {
                    summary: 'OC-SVM machine learning detected multi-feature deviation',
                    illnesses: [],
                    recommendation: 'Evaluate clinical vitals.'
                },
                is_rule_based: false,
                is_ml_based: true
            });
            continue;
        }

        // Check if our rule engine already generated an alert for this exact vital category
        const existingIdx = combined.findIndex(r => {
            if (r.vital === aiVital) return true;
            if (r.anomaly_type && aiAlert.vital && r.anomaly_type.includes(aiAlert.vital)) return true;
            return false;
        });

        if (existingIdx === -1) {
            // New alert caught by AI that wasn't in rules
            combined.push({
                ...aiAlert,
                anomaly_type: `rule_${aiVital}`,
                is_rule_based: false,
                is_ml_based: true
            });
        } else {
            // Priority upgrade: if either source detected 'critical', ensure final alert is 'critical'
            if (aiAlert.severity === 'critical') {
                combined[existingIdx].severity = 'critical';
            }
        }
    }

    return combined;
}

module.exports = {
    evaluateClinicalRules,
    mergeRuleAndAiAlerts,
    CLINICAL_THRESHOLDS,
    DELTA_THRESHOLDS
};
