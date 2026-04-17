const router = require('express').Router();
const pool = require('../db');
const { verifyToken, enforceBreakGlassForSysAdmin } = require('../middleware/authMiddleware');

// Apply Security Middleware
router.use(verifyToken);
// [TECHNICAL DEBT] enforceBreakGlassForSysAdmin is disabled for development testing.
// MUST be re-enabled before production: router.use(enforceBreakGlassForSysAdmin);

// ==========================================
// 0. GET ALL DEVICES (Inventory - Moved to Top)
// ==========================================
router.get('/devices', async (req, res) => {
    console.log("GET /api/caregiver/devices hit"); // [DEBUG] Confirm route is hit
    try {
        const result = await pool.query(
            `SELECT d.serial_number, d.device_name, d.status, d.last_heartbeat, d.firmware_version,
                    d.assigned_patient_id, p.name as assigned_patient_name
             FROM device_whitelist d
             LEFT JOIN patients p ON d.assigned_patient_id = p.patient_id
             ORDER BY d.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Fetch Devices Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch device inventory' });
    }
});

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
        // Admins and medical_staff bypass the access table check.
        if (role !== 'admin' && role !== 'medical_staff') {
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
        if (role !== 'admin' && role !== 'medical_staff') {
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
                    ) as diaper_device_sn
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
                    ) as diaper_device_sn
                FROM patients p
                JOIN patient_access pa ON p.patient_id = pa.patient_id
                WHERE pa.user_id = $1 AND p.is_archived IS DISTINCT FROM TRUE
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



// ==========================================
// 3.9. GET CARE TEAM FOR PATIENT
// ==========================================
router.get('/patients/:id/care-team', async (req, res) => {
    console.log(`[DEBUG] GET /patients/${req.params.id}/care-team hit`);
    try {
        const patientId = req.params.id;
        const result = await pool.query(
            `SELECT u.user_id, u.first_name, u.last_name, u.email, u.role as system_role,
                    pa.relationship, pa.access_level
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

module.exports = router;
