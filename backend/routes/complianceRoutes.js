const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

const COMPLIANCE_VERSION = 'v1.0';

/**
 * Legal & Clinical Compliance Forms Dictionary for the ALAGA Monitoring System.
 * Covers Philippine Republic Act 10173 (Data Privacy Act of 2012), HIPAA Security Rule alignment,
 * Medical Device Decision-Support Disclaimers, and Telemetry Privacy.
 */
const COMPLIANCE_FORMS = [
    {
        id: 'terms_and_conditions',
        title: 'Platform Terms and Conditions',
        category: 'Legal & Terms of Service',
        role_scope: 'all', // all users (parent, caregiver, medical_staff, admin)
        summary: 'Governs acceptable use of the ALAGA healthcare monitoring portal, account responsibilities, system uptime, and auxiliary hardware disclaimers.',
        content: `1. ACCEPTANCE OF TERMS
By accessing or using the ALAGA Healthcare Monitoring System (Web and Mobile Applications, firmware-enabled IoT clips, and cloud services), you acknowledge and agree to be bound by these Platform Terms and Conditions. If you do not agree with any provision herein, you must refrain from accessing or utilizing the platform.

2. SERVICE SCOPE & HARDWARE DISCLAIMER
ALAGA provides continuous, auxiliary non-invasive physiological vital sign tracking (heart rate, blood oxygen SpO2, body temperature) and diaper moisture telemetry. ALAGA HARDWARE DEVICES ARE AUXILIARY MONITORING AIDS AND ARE NOT CERTIFIED AS LIFE-SUPPORT SYSTEMS. The system is designed to augment, not substitute, hands-on clinical observation, parental attentiveness, and professional medical supervision.

3. ACCOUNT CREDENTIALS & SECURITY OBLIGATIONS
Users are solely responsible for preserving the confidentiality of their login credentials, one-time passwords (OTP), and two-factor authentication tokens. Any activity conducted under your authenticated session is deemed authorized. Unauthorized sharing of credentials with third parties constitutes a violation of these terms and may result in immediate suspension.

4. SYSTEM AVAILABILITY & CONNECTIVITY LIMITATIONS
Telemetry streaming relies on local Wi-Fi, battery capacity, cellular internet connectivity, and cloud backend availability. While ALAGA implements automatic store-and-forward buffers during network drops, ALAGA does not guarantee continuous uninterrupted service in environments experiencing power outages, RF interference, or ISP disruptions.

5. INTELLECTUAL PROPERTY
All software code, user interface designs, ML algorithms, algorithms, diagnostic graphs, trademarks, and documentation are proprietary property of ALAGA and its licensors, protected under applicable copyright and intellectual property legislation.

6. TERMINATION & SUSPENSION
ALAGA reserves the right to suspend or revoke access to any user who engages in automated screen scraping, unauthorized reverse engineering of hardware endpoints, or violations of privacy laws.`,
    },
    {
        id: 'privacy_policy',
        title: 'Platform Privacy Policy & Health Data Protection',
        category: 'Data Governance & Privacy',
        role_scope: 'all',
        summary: 'Details the lawful processing of Personal Health Information (PHI) under Philippine Republic Act 10173 (Data Privacy Act of 2012) and international security standards.',
        content: `1. STATUTORY COMPLIANCE & PRINCIPLES
In strict accordance with Republic Act No. 10173 (Philippine Data Privacy Act of 2012) and international clinical data privacy benchmarks, ALAGA adheres to transparency, legitimate purpose, and proportionality in collecting and processing Personal Health Information (PHI) and Sensitive Personal Information (SPI).

2. INFORMATION COLLECTED
We collect and securely process:
- Account Demographics: Full name, verified email address, mobile number, assigned clinical facility, and system role.
- Patient Demographics: Patient full name, birthdate, room/ward assignment, diagnosis, emergency contacts, and assigned care team.
- Real-Time Clinical Telemetry: Heart rate (BPM), blood oxygen saturation (SpO2 %), estimated body temperature (°C), diaper moisture percentages, sensor attachment status, and device battery/signal telemetry.
- Security & Audit Trails: IP addresses, access timestamps, authentication outcomes, and operator acknowledgment actions.

3. ENCRYPTION & DATA STORAGE
All telemetry transmitted between IoT sensors, mobile devices, web clients, and backend endpoints is encrypted in transit using Transport Layer Security (TLS 1.3). Database records are encrypted at rest with AES-256 standards. Direct device-to-cloud streams require SHA-256 cryptographic hardware token verification.

4. ACCESS CONTROL & ROLE-BASED SEGREGATION
Access to patient telemetry is strictly scoped:
- Parents & Guardians: Access exclusively to their enrolled children or dependents.
- Caregivers & Medical Staff: Access limited exclusively to patients assigned to their active roster or facility ward.
- System Administrators: Access to de-identified telemetry and administrative governance records without unauthorized exposure of confidential clinical charts.

5. DATA SUBJECT RIGHTS
Under the Data Privacy Act, you maintain the right to:
- Be informed whether personal health data is being processed.
- Reasonable access to your personal information and historical telemetry logs.
- Dispute inaccuracies or rectify erroneous records.
- Suspend, withdraw, or order the removal of your personal health data upon formal written notification, subject to legal clinical record retention obligations.`,
    },
    {
        id: 'telemetry_authorization',
        title: 'Informed Health Data Consent & Continuous Telemetry Authorization',
        category: 'Clinical Telemetry Consent',
        role_scope: 'all',
        summary: 'Explicit authorization for continuous optical biometric streaming, smart diaper moisture sampling, and multi-user care team monitoring.',
        content: `1. PURPOSE OF CONTINUOUS MONITORING
Continuous telemetry collection enables immediate identification of acute physiological changes, fever onset, hypoxia episodes, and wet diaper saturation, minimizing complications such as skin dermatitis, pressure ulcers, and undetected vital sign deterioration.

2. NATURE OF WEARABLE SENSORS
You authorize the placement and operation of:
- MAX30102 Optical PPG Clip: Utilizes low-intensity non-ionizing red and infrared LEDs placed against the wrist or foot sole to calculate pulsatile blood volume changes.
- Conductive Moisture Probe: Low-voltage resistive/capacitive sensing strip placed on the diaper core to detect urine presence and saturation levels.
- Lithium-Ion Battery Power Module: Low-voltage battery pack powering the device standalone without mains electrical connection.

3. POTENTIAL RISKS & SKIN INTEGRITY
While sensor components utilize medical-grade, hypoallergenic casings and operate at negligible electrical potential (<3.3V), prolonged contact against sensitive skin may occasionally cause minor redness or localized indentation. Caregivers and parents agree to routinely inspect patient skin during diaper changes and reposition sensor bands as needed.

4. MULTI-USER CARE TEAM DISCLOSURE
By enrolling a patient in ALAGA, you authorize designated caregivers, attending nurses, and clinic administrators associated with the patient's care team to view live telemetry, acknowledge notifications, and review historical trends.`,
    },
    {
        id: 'ai_decision_support_disclaimer',
        title: 'AI Assistive Decision-Support & Clinical Telemetry Disclaimer',
        category: 'AI & Algorithm Disclaimer',
        role_scope: 'all',
        summary: 'Important clinical safeguard declaring that Machine Learning anomaly algorithms (One-Class SVM) and threshold rule engines serve auxiliary decision-support functions only.',
        content: `1. ASSISTIVE NATURE OF ALGORITHMIC ANALYSIS
ALAGA employs artificial intelligence decision-support algorithms—including One-Class Support Vector Machines (OC-SVM) and physiological rule engines—to detect potential physiological vital anomalies and wetness patterns.

2. NOT A DIAGNOSTIC DEVICE
THE ALAGA AI ENGINE AND THRESHOLD ALARMS ARE STRICTLY ASSISTIVE CLINICAL DECISION-SUPPORT TOOLS (CDST) AND DO NOT CONSTITUTE A MEDICAL DIAGNOSIS, PROGNOSIS, OR INDEPENDENT CLINICAL PRESCRIPTION. The algorithms are intended solely to draw attention to potential deviations from established patient baselines.

3. PRIMACY OF HUMAN CLINICAL JUDGMENT
Healthcare decisions, emergency triage, medication delivery, and treatment plans must always be verified by licensed healthcare practitioners, nurses, or qualified guardians using standard clinical diagnostic tools (e.g. manual sphygmomanometers, clinical thermometers, laboratory assays). Never alter prescribed medical treatment solely based on algorithmic suggestions.

4. LIMITATIONS OF OPTICAL MEASUREMENTS
Optical pulse oximetry may be influenced by patient motion artifacts, ambient light leakage, hypothermia, peripheral vasoconstriction, or irregular sensor seating. In instances of sudden abnormal readings, always inspect patient physical presentation before clinical intervention.`,
    },
    {
        id: 'staff_nda_acceptable_use',
        title: 'Healthcare Staff Non-Disclosure & Acceptable Use Agreement',
        category: 'Institutional Confidentiality & Staff NDA',
        role_scope: 'staff', // caregiver, medical_staff, facility_admin, admin, sysadmin
        summary: 'Strict confidentiality covenants for caregivers, nurses, and administrative personnel prohibiting unauthorized extraction, photography, or sharing of patient charts.',
        content: `1. CONFIDENTIALITY COVENANT
As an authorized caregiver, medical staff member, or institutional administrator of the ALAGA Healthcare Monitoring System, you are entrusted with confidential Personal Health Information (PHI). You expressly agree to maintain absolute confidentiality regarding all patient vitals, diagnosis notes, care logs, and medical histories accessed through this platform.

2. PROHIBITED ACTIONS
You strictly agree NOT to:
- Capture screen recordings, mobile screenshots, or photographs of patient monitoring screens unless authorized for clinical documentation within encrypted hospital channels.
- Disclose or transmit patient names, vitals, or medical conditions to unauthorized individuals, family members not registered in the care team, or social media platforms.
- Share your individual staff credentials, PINs, or biometric tokens with colleagues or temporary staff.
- Access patient records outside your assigned shift, ward, or designated clinical care scope.
- Export or download spreadsheets containing patient identifiers to unauthorized personal devices.

3. AUDIT TRAILS & BREACH INVESTIGATION
Every click, screen view, filter query, and alert acknowledgment is permanently recorded in forensic access logs with your user ID, timestamp, and IP address. The institution conducts regular forensic SIEM audits.

4. PENALTIES FOR BREACH
Breach of this confidentiality covenant constitutes gross misconduct punishable by immediate revocation of credentials, termination of clinical employment, disciplinary referral to professional licensing boards (e.g. Professional Regulation Commission), and civil or criminal prosecution under Philippine Republic Act 10173 with penalties including substantial fines and imprisonment.`,
    },
    {
        id: 'emergency_escalation_protocol',
        title: 'Emergency Care & Escalation Protocol Acknowledgment',
        category: 'Emergency Protocols',
        role_scope: 'all',
        summary: 'Operational instructions and escalation protocols when emergency vital signs (critical tachycardia, bradycardia, severe hypoxia, or hyperpyrexia) are triggered.',
        content: `1. CRITICAL VITAL ACTION THRESHOLDS
When an alarm status switches to "CRITICAL" (e.g. SpO2 < 90%, Heart Rate > 140 bpm or < 45 bpm, Body Temperature > 38.5°C):
- Step 1: Immediately perform physical assessment of the patient's breathing, skin color, and responsiveness.
- Step 2: Confirm sensor clip placement to rule out displacement or entanglement.
- Step 3: Initiate standard facility clinical protocol or call designated physician / emergency services (e.g. 911 / Hospital Emergency Department).

2. NETWORK DISRUPTIONS IN EMERGENCIES
If network status indicates "Offline" or "Disconnected", the mobile application will alert you that telemetry is suspended. IN CRITICAL OR LIFE-THREATENING EMERGENCIES, NEVER DELAY CONTACTING EMERGENCY MEDICAL RESPONDERS WHILE TROUBLESHOOTING WI-FI OR MOBILE CONNECTIVITY.

3. ACKNOWLEDGMENT OF RESPONSIBILITY
By signing below, you acknowledge that you have reviewed the emergency escalation protocols and understand the imperative of swift physical clinical evaluation upon receiving critical alarms.`,
    }
];

// ────────────────────────────────────────────────────────────────────────────
// GET /api/compliance/forms
// Returns active compliance agreements formatted for display in web and mobile
// ────────────────────────────────────────────────────────────────────────────
router.get('/forms', async (req, res) => {
    try {
        const userRole = (req.query.role || req.user?.role || 'parent').toLowerCase();
        const isStaff = ['caregiver', 'medical_staff', 'facility_admin', 'admin', 'sysadmin', 'system_admin'].includes(userRole);

        // Filter forms applicable to this role
        const filteredForms = COMPLIANCE_FORMS.filter(f => {
            if (f.role_scope === 'all') return true;
            if (f.role_scope === 'staff') return isStaff;
            return false;
        });

        res.json({
            success: true,
            version: COMPLIANCE_VERSION,
            count: filteredForms.length,
            forms: filteredForms
        });
    } catch (err) {
        console.error('[COMPLIANCE] Error fetching forms:', err.message);
        res.status(500).json({ success: false, message: 'Failed to load compliance agreements.' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/compliance/status
// Checks if current authenticated user has accepted the latest compliance agreements
// ────────────────────────────────────────────────────────────────────────────
router.get('/status', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT consent_agreed_at, consent_version, must_accept_terms, role 
             FROM users WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const user = result.rows[0];
        const hasAccepted = !!user.consent_agreed_at && user.consent_version === COMPLIANCE_VERSION && !user.must_accept_terms;

        // Fetch latest audit record
        const consentLog = await pool.query(
            `SELECT consent_id, consent_version, forms_accepted, agreed_at 
             FROM user_consents 
             WHERE user_id = $1 
             ORDER BY agreed_at DESC LIMIT 1`,
            [userId]
        );

        res.json({
            success: true,
            must_accept_terms: !hasAccepted,
            consent_agreed_at: user.consent_agreed_at,
            consent_version: user.consent_version,
            active_version: COMPLIANCE_VERSION,
            last_acceptance: consentLog.rows[0] || null
        });
    } catch (err) {
        console.error('[COMPLIANCE] Error fetching status:', err.message);
        res.status(500).json({ success: false, message: 'Failed to check compliance status.' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/compliance/accept
// Records user's explicit consent after scrolling through the forms
// Supports both authenticated session (JWT) and post-OTP context (user_id + token)
// ────────────────────────────────────────────────────────────────────────────
router.post('/accept', async (req, res) => {
    try {
        let userId = null;
        const rawAuth = req.headers.authorization;
        if (rawAuth && rawAuth.startsWith('Bearer ')) {
            const jwt = require('jsonwebtoken');
            const token = rawAuth.split(' ')[1];
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'alaga_secret_key_2026');
                userId = decoded.id;
            } catch (_) {}
        }

        if (!userId && req.body.user_id) {
            userId = parseInt(req.body.user_id, 10);
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User ID or valid authorization required to record consent.' });
        }

        const { forms_accepted = [], version = COMPLIANCE_VERSION } = req.body;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '';
        const userAgent = req.headers['user-agent'] || '';

        // Verify user exists
        const userCheck = await pool.query('SELECT user_id, role, first_name, email FROM users WHERE user_id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User record not found.' });
        }

        const userRow = userCheck.rows[0];

        // Begin transaction
        await pool.query('BEGIN');

        // 1. Insert permanent audit record into user_consents
        const consentRes = await pool.query(
            `INSERT INTO user_consents (user_id, consent_version, forms_accepted, ip_address, user_agent, agreed_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING consent_id, agreed_at`,
            [userId, version, JSON.stringify(forms_accepted), String(clientIp).slice(0, 45), String(userAgent).slice(0, 500)]
        );

        // 2. Update users table flags
        await pool.query(
            `UPDATE users 
             SET consent_agreed_at = NOW(),
                 consent_version = $2,
                 must_accept_terms = FALSE
             WHERE user_id = $1`,
            [userId, version]
        );

        // 3. Log to access_logs for clinical SIEM forensic auditing
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, ip_address, severity, status, details)
             VALUES ($1, 'CONSENT_ACCEPTED', 'COMPLIANCE_POLICIES', $2, 'INFO', 'SUCCESS', $3)`,
            [
                userId,
                String(clientIp).slice(0, 45),
                JSON.stringify({
                    version: version,
                    forms_count: forms_accepted.length,
                    user_role: userRow.role,
                    email: userRow.email
                })
            ]
        ).catch(() => {});

        await pool.query('COMMIT');

        console.log(`✅ [COMPLIANCE] User #${userId} (${userRow.role}) accepted compliance policies version ${version}`);

        res.json({
            success: true,
            message: 'Compliance consents successfully accepted and recorded in clinical audit trail.',
            consent_id: consentRes.rows[0]?.consent_id,
            agreed_at: consentRes.rows[0]?.agreed_at,
            must_accept_terms: false
        });

    } catch (err) {
        await pool.query('ROLLBACK').catch(() => {});
        console.error('[COMPLIANCE] Accept Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to record compliance agreement.' });
    }
});

module.exports = router;
