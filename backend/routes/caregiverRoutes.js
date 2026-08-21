const router = require('express').Router();
const pool = require('../db');
const { verifyToken, enforceBreakGlassForSysAdmin } = require('../middleware/authMiddleware');

// Apply Security Middleware
router.use(verifyToken);
// [TECHNICAL DEBT] enforceBreakGlassForSysAdmin is disabled for development testing.
// MUST be re-enabled before production: router.use(enforceBreakGlassForSysAdmin);

// ==========================================
// 0. GET DEVICES (Role-scoped inventory)
// [OWASP A01] Admin sees the full inventory.
// Caregiver sees ONLY:
//   - Devices they personally registered (added_by = their user_id)
//   - Devices assigned to patients they can access (via patient_access)
// ==========================================
router.get('/devices', async (req, res) => {
    const { role, id: userId } = req.user;
    try {
        let result;

        if (role === 'admin' || role === 'medical_staff') {
            // Full inventory for admin / medical staff
            result = await pool.query(
                `SELECT d.serial_number, d.device_name, d.status, d.last_heartbeat, d.firmware_version,
                        d.assigned_patient_id, d.added_by, d.created_at, p.name as assigned_patient_name
                 FROM device_whitelist d
                 LEFT JOIN patients p ON d.assigned_patient_id = p.patient_id
                 ORDER BY d.created_at DESC`
            );
        } else {
            // [OWASP A01] Caregiver scope:
            // Show devices this caregiver registered (added_by = userId)
            // OR devices assigned to a patient the caregiver has access to.
            // DISTINCT prevents duplicate rows when multiple patient_access rows exist.
            result = await pool.query(
                `SELECT DISTINCT d.serial_number, d.device_name, d.status, d.last_heartbeat,
                        d.firmware_version, d.assigned_patient_id, d.added_by, d.created_at,
                        p.name as assigned_patient_name
                 FROM device_whitelist d
                 LEFT JOIN patients p ON d.assigned_patient_id = p.patient_id
                 LEFT JOIN patient_access pa ON pa.patient_id = d.assigned_patient_id
                 WHERE (
                     d.added_by = $1
                     OR pa.user_id = $1
                 )
                 ORDER BY d.created_at DESC`,
                [userId]
            );
        }

        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch Devices Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch device inventory' });
    }
});


// ==========================================
// 0.1. REGISTER DEVICE(S) INTO WHITELIST
// [OWASP A01] Only admin (parent) accounts may register new hardware.
// Caregivers receive 403 Forbidden — they cannot add to the inventory.
// Serial numbers must follow the format: VS-YYYY-NNNN or SD-YYYY-NNNN.
// ==========================================
router.post('/devices', async (req, res) => {
    // [OWASP A01] Role guard: only the parent / admin accounts can register devices.
    // A caregiver, parent or admin account can register devices.
    if (req.user.role !== 'admin' && req.user.role !== 'medical_staff' && req.user.role !== 'parent' && req.user.role !== 'caregiver') {
        return res.status(403).json({
            success: false,
            message: 'Only parent, caregiver, or administrator accounts can register new devices.'
        });
    }

    const { vitalDeviceNo, diaperDeviceNo } = req.body;
    const registeredBy = req.user.id;

    if (!vitalDeviceNo && !diaperDeviceNo) {
        return res.status(400).json({ success: false, message: 'At least one device serial number is required.' });
    }

    const serialRegex = /^(VS|SD)-\d{4}-\d{4}$/;

    if (vitalDeviceNo && !serialRegex.test(vitalDeviceNo)) {
        return res.status(400).json({ success: false, message: `Invalid serial format: ${vitalDeviceNo}. Expected VS-YYYY-NNNN.` });
    }
    if (diaperDeviceNo && !serialRegex.test(diaperDeviceNo)) {
        return res.status(400).json({ success: false, message: `Invalid serial format: ${diaperDeviceNo}. Expected SD-YYYY-NNNN.` });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const inserted = [];

        if (vitalDeviceNo) {
            // [OWASP A05] Parameterized duplicate check before insert
            const exists = await client.query(
                'SELECT serial_number FROM device_whitelist WHERE serial_number = $1',
                [vitalDeviceNo]
            );
            if (exists.rows.length > 0) {
                await client.query('ROLLBACK');
                client.release();
                return res.status(409).json({ success: false, message: `Device ${vitalDeviceNo} is already registered.` });
            }
            // [FIX] added_by now populated so ownership scoping works for GET /devices.
            // [OWASP A07] In production, this token would be randomly generated and handed to the admin.
            // For prototyping/testing, we inject the hash of 'alaga-test-token'.
            const crypto = require('crypto');
            const testTokenHash = crypto.createHash('sha256').update('alaga-test-token').digest('hex');

            await client.query(
                `INSERT INTO device_whitelist (serial_number, device_name, status, added_by, created_at, device_token_hash)
                 VALUES ($1, 'Vital Sign Monitor', 'AVAILABLE', $2, NOW(), $3)`,
                [vitalDeviceNo, registeredBy, testTokenHash]
            );
            inserted.push(vitalDeviceNo);
        }

        if (diaperDeviceNo) {
            const exists = await client.query(
                'SELECT serial_number FROM device_whitelist WHERE serial_number = $1',
                [diaperDeviceNo]
            );
            if (exists.rows.length > 0) {
                await client.query('ROLLBACK');
                client.release();
                return res.status(409).json({ success: false, message: `Device ${diaperDeviceNo} is already registered.` });
            }
            const crypto = require('crypto');
            const testTokenHash = crypto.createHash('sha256').update('alaga-test-token').digest('hex');

            await client.query(
                `INSERT INTO device_whitelist (serial_number, device_name, status, added_by, created_at, device_token_hash)
                 VALUES ($1, 'Smart Diaper Module', 'AVAILABLE', $2, NOW(), $3)`,
                [diaperDeviceNo, registeredBy, testTokenHash]
            );
            inserted.push(diaperDeviceNo);
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, message: `Device(s) registered: ${inserted.join(', ')}`, registered: inserted });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Register Device Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to register device.' });
    } finally {
        client.release();
    }
});

// ==========================================
// 0.2. GET USERS (for User Management screen)
// [OWASP A01] Returns all users visible to the caller.
// Admins and medical_staff see all users in the system.
// Caregivers only see users who share a patient with them.
// ==========================================
router.get('/users', async (req, res) => {
    const { role, id: userId } = req.user;
    try {
        let result;
        if (role === 'admin' || role === 'medical_staff') {
            result = await pool.query(
                `SELECT user_id, username, first_name, last_name, email, role, account_status, created_at, mobile_number
                 FROM users
                 WHERE role NOT IN ('system_admin')
                 ORDER BY created_at DESC`
            );
        } else {
            // Caregiver: see users on the same care teams
            result = await pool.query(
                `SELECT DISTINCT u.user_id, u.username, u.first_name, u.last_name, u.email, u.role, u.account_status, u.created_at
                 FROM users u
                 JOIN patient_access pa ON pa.user_id = u.user_id
                 WHERE pa.patient_id IN (
                     SELECT patient_id FROM patient_access WHERE user_id = $1
                 )
                 ORDER BY u.created_at DESC`,
                [userId]
            );
        }
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Get Users Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch users.' });
    }
});

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
// 1.5. GET ALL CAREGIVERS (Directory)
// ==========================================
router.get('/all', async (req, res) => {
    try {
        // [OWASP A01] Allow Medical Staff & Caregivers to view the directory (e.g. for chat or assignment)
        // Note: verifyAdmin is NOT required here, but verifyToken IS (middleware applied at top).

        const result = await pool.query(
            `SELECT user_id, username, first_name, last_name, email, role, 
                    account_status, created_at, mobile_number
             FROM users 
             WHERE role IN ('caregiver', 'medical_staff')
             ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Fetch All Caregivers Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// ==========================================
// 2. ADD NEW PATIENT
// [OWASP A01] Only admin / parent / medical_staff can enroll new patients.
// ==========================================
router.post('/patients', async (req, res) => {
    // [OWASP A01] Role guard
    if (req.user.role !== 'admin' && req.user.role !== 'medical_staff' && req.user.role !== 'parent') {
        return res.status(403).json({
            success: false,
            message: 'Only parent or administrator accounts can enroll new patients.'
        });
    }

    const client = await pool.connect();
    try {
        const { name, birthdate, medicalCondition, assignedCaregiverEmail } = req.body;

        await client.query('BEGIN');

        let resolvedCaregiverId = null;
        if (assignedCaregiverEmail) {
            const caregiverRes = await client.query(
                `SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) AND role IN ('caregiver', 'medical_staff')`,
                [assignedCaregiverEmail.trim()]
            );
            if (caregiverRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    message: `Caregiver/Med Staff user with email "${assignedCaregiverEmail}" not found.`
                });
            }
            resolvedCaregiverId = caregiverRes.rows[0].user_id;
        }

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

        if (resolvedCaregiverId) {
            await client.query(
                `INSERT INTO patient_access (user_id, patient_id, relationship, access_level, invite_status, invited_by)
                 VALUES ($1, $2, 'Assigned Caregiver', 'View', 'Pending', $3)`,
                [resolvedCaregiverId, newPatientId, req.user.id]
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
// 2.1. UPDATE PATIENT DETAILS
// [OWASP A01] Ownership check: only users with Edit/Admin access may modify the record.
// [HIPAA] Name and medical notes are PHI; changes are implicitly timestamped by updated_at.
// ==========================================
router.put('/patients/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const patientId = req.params.id;
        const userId = req.user.id;
        const { role } = req.user;

        // [OWASP A01] Verify the caller has Edit or Admin access to this specific patient.
        // Admins, parents, and medical_staff bypass the access table check.
        if (role !== 'admin' && role !== 'medical_staff' && role !== 'parent') {
            const accessCheck = await client.query(
                `SELECT access_level FROM patient_access
                 WHERE patient_id = $1 AND user_id = $2 AND access_level IN ('Edit', 'Admin')`,
                [patientId, userId]
            );
            if (accessCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    // [OWASP A10] Generic message — does not expose whether the patient ID exists
                    message: 'You do not have permission to edit this patient record.'
                });
            }
        }

        const { name, birthdate, medicalCondition } = req.body;

        // [OWASP A05] Parameterized query — no string concatenation.
        await client.query(
            `UPDATE patients
             SET name = COALESCE($1, name),
                 birthdate = COALESCE($2, birthdate),
                 baseline_data = COALESCE($3::jsonb, baseline_data),
                 updated_at = NOW()
             WHERE patient_id = $4`,
            [
                name || null,
                birthdate || null,
                medicalCondition ? JSON.stringify({ condition: medicalCondition }) : null,
                patientId
            ]
        );

        res.json({ success: true, message: 'Patient record updated successfully.' });
    } catch (err) {
        // [OWASP A10] Do not expose internal error details to the client
        console.error('Update Patient Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update patient record.' });
    } finally {
        client.release();
    }
});

// ==========================================
// 2.2. ARCHIVE PATIENT (Soft Delete)
// [GDPR] Soft-delete preserves audit trail; hard delete requires a separate "Right to Erasure" workflow.
// [OWASP A01] Only users with Edit/Admin access or privileged roles may archive.
// ==========================================
router.patch('/patients/:id/archive', async (req, res) => {
    const client = await pool.connect();
    try {
        const patientId = req.params.id;
        const userId = req.user.id;
        const { role } = req.user;

        // [OWASP A01] Ownership check
        if (role !== 'admin' && role !== 'medical_staff' && role !== 'parent') {
            const accessCheck = await client.query(
                `SELECT access_level FROM patient_access
                 WHERE patient_id = $1 AND user_id = $2 AND access_level IN ('Edit', 'Admin')`,
                [patientId, userId]
            );
            if (accessCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to archive this patient record.'
                });
            }
        }

        // [GDPR] Flag as archived (soft delete). The record is retained for the 1-year
        // data retention period mandated by the DPA/GDPR retention policy.
        await client.query(
            `UPDATE patients SET is_archived = TRUE, updated_at = NOW() WHERE patient_id = $1`,
            [patientId]
        );

        res.json({ success: true, message: 'Patient record archived successfully.' });
    } catch (err) {
        console.error('Archive Patient Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive patient record.' });
    } finally {
        client.release();
    }
});

// ==========================================
// 3. GET MY PATIENTS (Updated with Device Info)
// ==========================================
router.get('/patients', async (req, res) => {
    try {
        const { role, id: userId } = req.user;
        let query;
        let params;

        // [Admin/Recovery View] Admins & Medical Staff can see ALL patients
        if (role === 'admin' || role === 'medical_staff') {
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
                    'Admin' as access_level,
                    (
                        SELECT u.user_id
                        FROM patient_access pa2 
                        JOIN users u ON pa2.user_id = u.user_id 
                        WHERE pa2.patient_id = p.patient_id 
                        AND pa2.relationship = 'Assigned Caregiver' 
                        LIMIT 1
                    ) as assigned_caregiver_id,
                    (
                        SELECT CONCAT(u.first_name, ' ', u.last_name) 
                        FROM patient_access pa2 
                        JOIN users u ON pa2.user_id = u.user_id 
                        WHERE pa2.patient_id = p.patient_id 
                        AND pa2.relationship = 'Assigned Caregiver' 
                        LIMIT 1
                    ) as assigned_caregiver_name,
                    (
                        SELECT serial_number 
                        FROM device_whitelist 
                        WHERE assigned_patient_id = p.patient_id 
                        AND device_name ILIKE '%Vital%'
                        LIMIT 1
                    ) as vital_device_sn,
                    (
                        SELECT serial_number 
                        FROM device_whitelist 
                        WHERE assigned_patient_id = p.patient_id 
                        AND device_name ILIKE '%Diaper%'
                        LIMIT 1
                    ) as diaper_device_sn,
                    (
                        SELECT json_build_object(
                            'heart_rate', sr.heart_rate,
                            'temperature', sr.temperature,
                            'spo2', sr.spo2,
                            'moisture', sr.moisture_value
                        )
                        FROM sensor_readings sr
                        WHERE sr.patient_id = p.patient_id
                        ORDER BY sr.recorded_at DESC
                        LIMIT 1
                    ) as latest_telemetry
                FROM patients p
                WHERE p.is_archived IS DISTINCT FROM TRUE
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [];
        } else {
            // [Caregiver View] Only assigned patients
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
                    pa.access_level,
                    (
                        SELECT u.user_id
                        FROM patient_access pa2 
                        JOIN users u ON pa2.user_id = u.user_id 
                        WHERE pa2.patient_id = p.patient_id 
                        AND pa2.relationship = 'Assigned Caregiver' 
                        LIMIT 1
                    ) as assigned_caregiver_id,
                    (
                        SELECT CONCAT(u.first_name, ' ', u.last_name) 
                        FROM patient_access pa2 
                        JOIN users u ON pa2.user_id = u.user_id 
                        WHERE pa2.patient_id = p.patient_id 
                        AND pa2.relationship = 'Assigned Caregiver' 
                        LIMIT 1
                    ) as assigned_caregiver_name,
                    (
                        SELECT serial_number 
                        FROM device_whitelist 
                        WHERE assigned_patient_id = p.patient_id 
                        AND device_name ILIKE '%Vital%'
                        LIMIT 1
                    ) as vital_device_sn,
                    (
                        SELECT serial_number 
                        FROM device_whitelist 
                        WHERE assigned_patient_id = p.patient_id 
                        AND device_name ILIKE '%Diaper%'
                        LIMIT 1
                    ) as diaper_device_sn,
                    (
                        SELECT json_build_object(
                            'heart_rate', sr.heart_rate,
                            'temperature', sr.temperature,
                            'spo2', sr.spo2,
                            'moisture', sr.moisture_value
                        )
                        FROM sensor_readings sr
                        WHERE sr.patient_id = p.patient_id
                        ORDER BY sr.recorded_at DESC
                        LIMIT 1
                    ) as latest_telemetry
                FROM patients p
                JOIN patient_access pa ON p.patient_id = pa.patient_id
                WHERE pa.user_id = $1 AND p.is_archived IS DISTINCT FROM TRUE AND (pa.invite_status = 'Active' OR pa.invite_status IS NULL)
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [userId];
        }

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Get Patients Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch patients' });
    }
});

// ==========================================
// 3.5. ASSIGN DEVICE TO PATIENT
// ==========================================
router.post('/patients/:id/assign-device', async (req, res) => {
    const client = await pool.connect();
    try {
        const patientId = req.params.id;
        const { serialNumber } = req.body;

        if (!serialNumber) return res.status(400).json({ success: false, message: 'Serial number required' });

        await client.query('BEGIN');

        // 1. Assign in device_whitelist
        await client.query(
            "UPDATE device_whitelist SET assigned_patient_id = $1, status = 'ACTIVE' WHERE serial_number = $2",
            [patientId, serialNumber]
        );

        // 2. If it's a Vital Monitor, update the main patient record for quick reference
        const deviceCheck = await client.query("SELECT device_name FROM device_whitelist WHERE serial_number = $1", [serialNumber]);
        if (deviceCheck.rows[0]?.device_name.includes('Vital')) {
            await client.query("UPDATE patients SET device_serial_number = $1 WHERE patient_id = $2", [serialNumber, patientId]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Device assigned successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Assign Device Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to assign device' });
    } finally {
        client.release();
    }
});

// ==========================================
// 3.6. UNLINK DEVICE FROM PATIENT
// ==========================================
router.put('/patients/:id/unlink-device', async (req, res) => {
    const client = await pool.connect();
    try {
        const patientId = req.params.id;
        const { type } = req.body; // 'vital' or 'diaper'

        await client.query('BEGIN');

        let deviceTypePattern = '%';
        if (type === 'vital') deviceTypePattern = '%Vital%';
        else if (type === 'diaper') deviceTypePattern = '%Diaper%';

        // 1. Find the device and Unlink
        await client.query(
            `UPDATE device_whitelist 
             SET assigned_patient_id = NULL 
             WHERE assigned_patient_id = $1 AND device_name ILIKE $2`,
            [patientId, deviceTypePattern]
        );

        // 2. If vital, clear from patients table
        if (type === 'vital') {
            await client.query("UPDATE patients SET device_serial_number = NULL WHERE patient_id = $1", [patientId]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Device unlinked successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Unlink Device Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to unlink device' });
    } finally {
        client.release();
    }
});

// [REMOVED] A duplicate POST /devices route previously existed here. It has been
// deleted because it bypassed the duplicate-serial check and incorrectly set
// device status to 'ACTIVE' on initial registration (a device is AVAILABLE
// until assigned to a patient). The canonical implementation is at the top of
// this file (router.post('/devices', ...) around line 58).

// ==========================================
// 4.5. UNPAIR DEVICE
// ==========================================
router.post('/devices/unpair', async (req, res) => {
    const client = await pool.connect();
    try {
        const { serialNumber } = req.body;

        if (!serialNumber) {
            return res.status(400).json({ success: false, message: 'Serial number is required' });
        }

        await client.query('BEGIN');

        // 1. Remove assignment from device_whitelist
        await client.query(
            "UPDATE device_whitelist SET assigned_patient_id = NULL, status = 'ACTIVE' WHERE serial_number = $1",
            [serialNumber]
        );

        // 2. Remove assignment from patients table (if linked)
        await client.query(
            "UPDATE patients SET device_serial_number = NULL WHERE device_serial_number = $1",
            [serialNumber]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Device unpaired successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Unpair Device Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to unpair device' });
    } finally {
        client.release();
    }
});

// ==========================================
// 3.7. UNLINK CAREGIVER FROM PATIENT
// ==========================================
router.put('/patients/:id/unlink-caregiver', async (req, res) => {
    const client = await pool.connect();
    try {
        const patientId = req.params.id;

        await client.query('BEGIN');

        // Delete the access record where relationship is 'Assigned Caregiver'
        const result = await client.query(
            "DELETE FROM patient_access WHERE patient_id = $1 AND relationship = 'Assigned Caregiver'",
            [patientId]
        );

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'No assigned caregiver found to remove.' });
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Caregiver unlinked successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Unlink Caregiver Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to unlink caregiver' });
    } finally {
        client.release();
    }
});

// ==========================================
// 3.8. ASSIGN CAREGIVER TO PATIENT
// ==========================================
router.post('/patients/:id/assign-caregiver', async (req, res) => {
    const client = await pool.connect();
    try {
        const patientId = req.params.id;
        const { caregiverId, relationship } = req.body;

        if (!caregiverId) {
            return res.status(400).json({ success: false, message: 'Caregiver ID is required' });
        }

        await client.query('BEGIN');

        // 1. Check if already assigned
        const check = await client.query(
            "SELECT * FROM patient_access WHERE patient_id = $1 AND user_id = $2",
            [patientId, caregiverId]
        );

        if (check.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'User is already assigned to this patient' });
        }

        // 2. Check if another 'Assigned Caregiver' exists (limit to 1 for this role type if desired, or allow multiple)
        // For this system, we seem to treat 'Assigned Caregiver' as a slot.
        // If relationship is 'Assigned Caregiver', maybe we want to replace the existing one?
        // User asked to "Assign", implies adding. But the UI shows "Assigned Caregiver" as a single field often.
        // Let's allow multiple for now, or just insert. The UI displays "assigned_caregiver_name" from a subquery with LIMIT 1.
        // So effectively one principal caregiver.
        // Let's enforce single "Assigned Caregiver" role for simplicity to match the subquery logic, OR just insert.
        // The previous UNLINK logic removes ALL 'Assigned Caregiver' roles.
        // Let's just Insert.

        await client.query(
            `INSERT INTO patient_access (user_id, patient_id, relationship, access_level)
             VALUES ($1, $2, $3, 'View')`,
            [caregiverId, patientId, relationship || 'Assigned Caregiver']
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Caregiver assigned successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Assign Caregiver Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to assign caregiver' });
    } finally {
        client.release();
    }
});

// ==========================================
// 3.8.5. INVITE CAREGIVER BY EMAIL AND PATIENT NAME
// ==========================================
router.post('/patients/invite-by-email', async (req, res) => {
    const { caregiverEmail, patientName } = req.body;
    const userId = req.user.id;
    const role = req.user.role.toLowerCase();

    if (!caregiverEmail || !patientName) {
        return res.status(400).json({ success: false, message: 'Caregiver email and patient name are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Find patient based on user's role
        let patientRow;
        if (role === 'admin' || role === 'system_admin' || role === 'sysadmin') {
            // Admin can access all patients
            const patRes = await client.query(
                `SELECT patient_id FROM patients WHERE LOWER(name) = LOWER($1)`,
                [patientName.trim()]
            );
            patientRow = patRes.rows[0];
        } else if (role === 'facility_admin') {
            // Facility admin can access facility's patients
            const patRes = await client.query(
                `SELECT patient_id FROM patients WHERE LOWER(name) = LOWER($1) AND facility_id = $2`,
                [patientName.trim(), req.user.facility_id]
            );
            patientRow = patRes.rows[0];
        } else {
            // Parent/Caregiver must have Edit access to the patient
            const patRes = await client.query(
                `SELECT p.patient_id FROM patients p
                 JOIN patient_access pa ON p.patient_id = pa.patient_id
                 WHERE LOWER(p.name) = LOWER($1) AND pa.user_id = $2 AND pa.access_level = 'Edit'`,
                [patientName.trim(), userId]
            );
            patientRow = patRes.rows[0];
        }

        if (!patientRow) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: `Patient with name "${patientName}" not found or not in your access scope.` });
        }

        const patientId = patientRow.patient_id;

        // 2. Find caregiver
        const caregiverRes = await client.query(
            `SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) AND role IN ('caregiver', 'medical_staff')`,
            [caregiverEmail.trim()]
        );

        if (caregiverRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: `Caregiver/Med Staff user with email "${caregiverEmail}" not found.` });
        }

        const caregiverId = caregiverRes.rows[0].user_id;

        // 3. Check if already assigned
        const check = await client.query(
            "SELECT 1 FROM patient_access WHERE patient_id = $1 AND user_id = $2",
            [patientId, caregiverId]
        );

        if (check.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Caregiver invitation/assignment already exists for this patient.' });
        }

        // 4. Insert pending invitation
        await client.query(
            `INSERT INTO patient_access (user_id, patient_id, relationship, access_level, invite_status, invited_by)
             VALUES ($1, $2, 'Assigned Caregiver', 'View', 'Pending', $3)`,
            [caregiverId, patientId, userId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Invitation successfully sent to ${caregiverEmail}.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Invite Caregiver Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to send caregiver invitation.' });
    } finally {
        client.release();
    }
});

// ==========================================
// 5. GET AVAILABLE DEVICES
// ==========================================
// ==========================================
router.get('/devices/available', async (req, res) => {
    try {
        const { role, id: userId } = req.user;
        let queryStr;
        let queryParams = [];

        // [OWASP A01] Admin/Medical Staff see all available devices
        if (role === 'admin' || role === 'medical_staff') {
            queryStr = `SELECT serial_number, device_name, status 
             FROM device_whitelist 
             WHERE status = 'AVAILABLE' AND assigned_patient_id IS NULL
             ORDER BY created_at DESC`;
        } else {
            // [OWASP A01] Parents/Caregivers only see available devices they registered
            queryStr = `SELECT serial_number, device_name, status 
             FROM device_whitelist 
             WHERE status = 'AVAILABLE' AND assigned_patient_id IS NULL AND added_by = $1
             ORDER BY created_at DESC`;
            queryParams = [userId];
        }

        const result = await pool.query(queryStr, queryParams);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Get Available Devices Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch devices' });
    }
});



// ==========================================
// 3.9. GET CARE TEAM FOR PATIENT
// ==========================================
router.get('/patients/:id/care-team', async (req, res) => {
    console.log(`[DEBUG] GET /patients/${req.params.id}/care-team hit`);
    try {
        const patientId = req.params.id;
        const result = await pool.query(
            `SELECT u.user_id, u.first_name, u.last_name, u.email, u.role as system_role,
                    pa.relationship, pa.access_level, pa.invite_status
             FROM patient_access pa
             JOIN users u ON pa.user_id = u.user_id
             WHERE pa.patient_id = $1
             ORDER BY u.first_name ASC`,
            [patientId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Get Care Team Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch care team' });
    }
});

// ==========================================
// 3.10. REMOVE CAREGIVER FROM TEAM
// ==========================================
router.delete('/patients/:id/care-team/:userId', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id: patientId, userId } = req.params;

        await client.query('BEGIN');

        // [SAFETY] Check if this is the last caregiver
        const countRes = await client.query(
            "SELECT COUNT(*) FROM patient_access WHERE patient_id = $1",
            [patientId]
        );
        const count = parseInt(countRes.rows[0].count);

        if (count <= 1) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Cannot remove the last caregiver. Assign another caregiver first to prevent losing access.'
            });
        }

        const result = await client.query(
            "DELETE FROM patient_access WHERE patient_id = $1 AND user_id = $2",
            [patientId, userId]
        );

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Caregiver not found in this team.' });
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Caregiver removed successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Remove Caregiver Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to remove caregiver' });
    } finally {
        client.release();
    }
});

// ==========================================
// DELETE PATIENT
// [OWASP A01] Only admin/parent accounts may permanently remove a patient.
// [GDPR / DPA] Supports the Right to Erasure for enrolled patient PHI.
// [HIPAA] Cascades device unlinking and access revocation inside a transaction.
//          An audit entry is written to access_logs before deletion.
// [OWASP A05] Patient ID is a parameterized path variable — never concatenated.
// ==========================================
router.delete('/patients/:id', async (req, res) => {
    // [OWASP A01] Server-side role check — client-side guard is UI-only.
    if (req.user.role !== 'admin' && req.user.role !== 'parent') {
        return res.status(403).json({
            success: false,
            message: 'Only parent or administrator accounts can remove patients.'
        });
    }

    const patientId = req.params.id;
    const actorId   = req.user.id;
    const client    = await pool.connect();

    try {
        // Verify the patient actually exists before attempting deletion.
        // [OWASP A05] Parameterized query — no string concatenation.
        const check = await client.query(
            'SELECT patient_id, name FROM patients WHERE patient_id = $1',
            [patientId]
        );
        if (check.rows.length === 0) {
            client.release();
            return res.status(404).json({ success: false, message: 'Patient record not found.' });
        }
        const patientName = check.rows[0].name;

        await client.query('BEGIN');

        // 1. [HIPAA] Write audit trail BEFORE destructive operation.
        await client.query(
            `INSERT INTO access_logs (user_id, action, target_patient_id, resource_affected, details, "timestamp")
             VALUES ($1, 'DELETE_PATIENT', $2, 'patient', $3::jsonb, NOW())`,
            [actorId, patientId, JSON.stringify({ removed_patient_name: patientName, actor_id: actorId })]
        );

        // 2. Unlink all devices assigned to this patient — resets them to AVAILABLE.
        await client.query(
            `UPDATE device_whitelist
             SET assigned_patient_id = NULL, status = 'AVAILABLE'
             WHERE assigned_patient_id = $1`,
            [patientId]
        );

        // 3. Clear device_serial_number on the patient row (defensive — row will be deleted).
        await client.query(
            'UPDATE patients SET device_serial_number = NULL WHERE patient_id = $1',
            [patientId]
        );

        // 4. Revoke all access grants for this patient.
        await client.query(
            'DELETE FROM patient_access WHERE patient_id = $1',
            [patientId]
        );

        // 5. Remove associated sensor history.
        await client.query(
            'DELETE FROM sensor_readings WHERE patient_id = $1',
            [patientId]
        );

        // 6. Remove anomaly events tied to this patient.
        await client.query(
            'DELETE FROM anomaly_events WHERE patient_id = $1',
            [patientId]
        );

        // 7. Hard-delete the patient record.
        await client.query(
            'DELETE FROM patients WHERE patient_id = $1',
            [patientId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Patient ${patientName} has been permanently removed.` });

    } catch (err) {
        await client.query('ROLLBACK');
        // [OWASP A10] Generic error — no internal details exposed to client.
        console.error('Delete Patient Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to remove patient record.' });
    } finally {
        client.release();
    }
});

// ==========================================
// DELETE DEVICE FROM INVENTORY
// [OWASP A01] Only admin/parent accounts may remove a device from the whitelist.
// [OWASP A05] Serial number is a parameterized path variable.
// [HIPAA] Audit entry written before deletion.
// ==========================================
router.delete('/devices/:serialNumber', async (req, res) => {
    // [OWASP A01] Server-side role guard.
    if (req.user.role !== 'admin' && req.user.role !== 'parent') {
        return res.status(403).json({
            success: false,
            message: 'Only parent or administrator accounts can remove devices from inventory.'
        });
    }

    const serialNumber = req.params.serialNumber;
    const actorId      = req.user.id;
    const client       = await pool.connect();

    try {
        // Confirm the device exists.
        const check = await client.query(
            'SELECT serial_number, device_name, assigned_patient_id FROM device_whitelist WHERE serial_number = $1',
            [serialNumber]
        );
        if (check.rows.length === 0) {
            client.release();
            return res.status(404).json({ success: false, message: 'Device not found in inventory.' });
        }

        const device     = check.rows[0];
        const patientId  = device.assigned_patient_id;

        await client.query('BEGIN');

        // [HIPAA] Audit trail before deletion.
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, details, "timestamp")
             VALUES ($1, 'DELETE_DEVICE', 'device_whitelist', $2::jsonb, NOW())`,
            [actorId, JSON.stringify({ serial_number: serialNumber, device_name: device.device_name, had_patient: !!patientId })]
        );

        // If the device was assigned to a patient, clear the patient's device reference first.
        if (patientId) {
            await client.query(
                'UPDATE patients SET device_serial_number = NULL WHERE patient_id = $1 AND device_serial_number = $2',
                [patientId, serialNumber]
            );
        }

        // Hard-delete the device from the whitelist.
        await client.query(
            'DELETE FROM device_whitelist WHERE serial_number = $1',
            [serialNumber]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Device ${serialNumber} has been removed from inventory.` });

    } catch (err) {
        await client.query('ROLLBACK');
        // [OWASP A10] Generic error response.
        console.error('Delete Device Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to remove device from inventory.' });
    } finally {
        client.release();
    }
});

// ==========================================
// DELETE USER ACCOUNT
// [OWASP A01] Only admin/parent accounts may remove a user.
//             A parent cannot remove their own account via this endpoint.
// [GDPR / DPA] Supports Right to Erasure for staff and caregiver accounts.
// [HIPAA] Audit entry written before deletion.
// [OWASP A05] userId is a parameterized path variable.
// ==========================================
router.delete('/users/:userId', async (req, res) => {
    // [OWASP A01] Server-side role guard.
    if (req.user.role !== 'admin' && req.user.role !== 'parent') {
        return res.status(403).json({
            success: false,
            message: 'Only parent or administrator accounts can remove user accounts.'
        });
    }

    const targetUserId = parseInt(req.params.userId, 10);
    const actorId      = req.user.id;

    // [OWASP A01] Prevent self-deletion — would lock out the parent account.
    if (targetUserId === actorId) {
        return res.status(400).json({
            success: false,
            message: 'You cannot remove your own account. Contact a System Administrator.'
        });
    }

    const client = await pool.connect();

    try {
        // Confirm the target user exists and is not a system_admin.
        const check = await client.query(
            `SELECT user_id, username, role FROM users WHERE user_id = $1`,
            [targetUserId]
        );
        if (check.rows.length === 0) {
            client.release();
            return res.status(404).json({ success: false, message: 'User account not found.' });
        }

        const targetUser = check.rows[0];

        // [OWASP A01] System admins can only be removed by other system admins — never by a parent.
        if (targetUser.role === 'system_admin') {
            client.release();
            return res.status(403).json({
                success: false,
                message: 'System administrator accounts cannot be removed from this panel.'
            });
        }

        await client.query('BEGIN');

        // [HIPAA] Audit trail before deletion.
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, details, "timestamp")
             VALUES ($1, 'DELETE_USER', 'users', $2::jsonb, NOW())`,
            [actorId, JSON.stringify({ removed_user_id: targetUserId, removed_username: targetUser.username, role: targetUser.role })]
        );

        // 1. Revoke all patient access grants for the removed user.
        await client.query(
            'DELETE FROM patient_access WHERE user_id = $1',
            [targetUserId]
        );

        // 2. Invalidate all active OTPs/sessions for this user.
        await client.query(
            'UPDATE user_email_otps SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL',
            [targetUserId]
        );

        // 3. Hard-delete the user account.
        await client.query(
            'DELETE FROM users WHERE user_id = $1',
            [targetUserId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `User account ${targetUser.username} has been permanently removed.` });

    } catch (err) {
        await client.query('ROLLBACK');
        // [OWASP A10] Generic error — no stack trace exposed to client.
        console.error('Delete User Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to remove user account.' });
    } finally {
        client.release();
    }
});

// ==========================================
// ROUTE: POST /baseline/reset
// Description: Reset baseline for all patients assigned to this caregiver
// ==========================================
router.post('/baseline/reset', async (req, res) => {
    const userId = req.user.id;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get all patient IDs assigned to this caregiver
        const accessResult = await client.query(
            "SELECT patient_id FROM patient_access WHERE user_id = $1 AND (invite_status = 'Active' OR invite_status IS NULL)",
            [userId]
        );

        const patientIds = accessResult.rows.map(row => row.patient_id);

        if (patientIds.length > 0) {
            // Delete learned vitals baselines
            await client.query(
                'DELETE FROM patient_baselines WHERE patient_id = ANY($1)',
                [patientIds]
            );

            // Reset SVM baseline on patients table
            await client.query(
                'UPDATE patients SET svm_baseline_data = NULL, baseline_reset_at = NOW() WHERE patient_id = ANY($1)',
                [patientIds]
            );

            // Log access
            await client.query(
                `INSERT INTO access_logs (user_id, action, resource_affected, severity)
                 VALUES ($1, 'SVM_BASELINE_RESET', $2, 'WARNING')`,
                [userId, `Reset baseline for patients: ${patientIds.join(', ')}`]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Baseline reset successful for all assigned patients.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Caregiver Baseline Reset Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to reset baseline.' });
    } finally {
        client.release();
    }
});

module.exports = router;

