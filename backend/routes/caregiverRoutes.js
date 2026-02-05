const router = require('express').Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// Apply Security Middleware
router.use(verifyToken);

// ==========================================
// 1. SEARCH USERS (For Caregiver Assignment)
// ==========================================
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query; // Expects ?query=emailOrName

        if (!query) {
            return res.status(400).json({ success: false, message: 'Query parameter required' });
        }

        // [OWASP A01] Search for caregivers/medical staff only.
        // Normalized search to lowercase for case-insensitive matching
        const result = await pool.query(
            `SELECT user_id, first_name, last_name, email, role 
             FROM users 
             WHERE (LOWER(email) LIKE LOWER($1) OR LOWER(username) LIKE LOWER($1) OR LOWER(last_name) LIKE LOWER($1))
             AND role IN ('caregiver', 'medical_staff')
             LIMIT 10`,
            [`%${query}%`]
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Search Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// ==========================================
// 2. ADD NEW PATIENT
// ==========================================
router.post('/patients', async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, birthdate, medicalCondition, assignedCaregiverId } = req.body;

        await client.query('BEGIN');

        // 1. Insert Patient
        const patientRes = await client.query(
            `INSERT INTO patients (name, birthdate, baseline_data, created_at)
             VALUES ($1, $2, $3, NOW())
             RETURNING patient_id`,
            [name, birthdate, JSON.stringify({ condition: medicalCondition })]
        );

        const newPatientId = patientRes.rows[0].patient_id;

        // 2. Grant Access to the Creator (Current User)
        await client.query(
            `INSERT INTO patient_access (user_id, patient_id, relationship, access_level)
             VALUES ($1, $2, 'Primary Caregiver', 'Edit')`,
            [req.user.id, newPatientId]
        );

        if (assignedCaregiverId) {
            await client.query(
                `INSERT INTO patient_access (user_id, patient_id, relationship, access_level)
                 VALUES ($1, $2, 'Assigned Caregiver', 'View')`,
                [assignedCaregiverId, newPatientId]
            );
        }

        // 4. Assign Devices (if provided)
        const { vitalDeviceNo, diaperDeviceNo } = req.body;

        if (vitalDeviceNo) {
            await client.query(
                "UPDATE device_whitelist SET assigned_patient_id = $1, status = 'ACTIVE' WHERE serial_number = $2",
                [newPatientId, vitalDeviceNo]
            );
            // Link to patient record too
            await client.query(
                "UPDATE patients SET device_serial_number = $1 WHERE patient_id = $2",
                [vitalDeviceNo, newPatientId]
            );
        }

        if (diaperDeviceNo) {
            await client.query(
                "UPDATE device_whitelist SET assigned_patient_id = $1, status = 'ACTIVE' WHERE serial_number = $2",
                [newPatientId, diaperDeviceNo]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, message: 'Patient enrolled successfully', patientId: newPatientId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Add Patient Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to enroll patient' });
    } finally {
        client.release();
    }
});

// ==========================================
// 3. GET MY PATIENTS
// ==========================================
router.get('/patients', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT ON (p.patient_id) 
                p.*, 
                pa.access_level,
                (
                    SELECT CONCAT(u.first_name, ' ', u.last_name) 
                    FROM patient_access pa2 
                    JOIN users u ON pa2.user_id = u.user_id 
                    WHERE pa2.patient_id = p.patient_id 
                    AND pa2.relationship = 'Assigned Caregiver' 
                    LIMIT 1
                ) as assigned_caregiver_name
             FROM patients p
             JOIN patient_access pa ON p.patient_id = pa.patient_id
             WHERE pa.user_id = $1 AND p.is_archived IS DISTINCT FROM TRUE
             ORDER BY p.patient_id, p.created_at DESC`,
            [req.user.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Get Patients Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch patients' });
    }
});

// ==========================================
// 4. ADD NEW DEVICE
// ==========================================
// ==========================================
// 4. ADD NEW DEVICE
// ==========================================
router.post('/devices', async (req, res) => {
    try {
        const { vitalDeviceNo, diaperDeviceNo } = req.body;

        // Note: For this prototype, we are just adding them to the whitelist.

        // Insert Vital Sign Device
        if (vitalDeviceNo) {
            await pool.query(
                `INSERT INTO device_whitelist (serial_number, device_name, added_by, status)
                 VALUES ($1, 'Vital Sign Monitor', $2, 'ACTIVE')
                 ON CONFLICT (serial_number) DO NOTHING`,
                [vitalDeviceNo, req.user.id]
            );
        }

        // Insert Smart Diaper Device
        if (diaperDeviceNo) {
            await pool.query(
                `INSERT INTO device_whitelist (serial_number, device_name, added_by, status)
                 VALUES ($1, 'Smart Diaper Module', $2, 'ACTIVE')
                 ON CONFLICT (serial_number) DO NOTHING`,
                [diaperDeviceNo, req.user.id]
            );
        }

        res.status(201).json({ success: true, message: 'Devices registered successfully' });

    } catch (err) {
        console.error("Add Device Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to register devices' });
    }
});

// ==========================================
// 5. GET AVAILABLE DEVICES
// ==========================================
router.get('/devices/available', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT serial_number, device_name, status 
             FROM device_whitelist 
             WHERE status = 'ACTIVE' AND assigned_patient_id IS NULL
             ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Get Available Devices Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch devices' });
    }
});

module.exports = router;
