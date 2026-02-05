const router = require('express').Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// Apply Security Middleware
router.use(verifyToken);

// ==========================================
// 1. GET MY ASSIGNMENTS (Dashboard View)
// ==========================================
router.get('/my-assignments', async (req, res) => {
    try {
        console.log("DEBUG: Handling /my-assignments for user", req.user.id);

        // DEBUG SCHEMA
        const schemaRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'patients'");
        console.log("DEBUG: Patients Columns:", schemaRes.rows.map(r => r.column_name).join(', '));

        // [OWASP A01] IDOR Protection: Implicit logging user is automatically filtered
        // [FIX] Use DISTINCT ON to case duplicates if a user was accidentally assigned twice
        const result = await pool.query(
            `SELECT DISTINCT ON (p.patient_id)
                p.patient_id, p.name, p.device_serial_number,
                pa.access_level, pa.relationship,
                (SELECT COUNT(*) FROM patient_access WHERE patient_id = p.patient_id) as care_team_count
             FROM patients p
             JOIN patient_access pa ON p.patient_id = pa.patient_id
             WHERE pa.user_id = $1 AND p.is_archived IS DISTINCT FROM TRUE
             ORDER BY p.patient_id, pa.access_level ASC`, // 'Admin' < 'Edit' < 'View', so ASC picks stronger permission first
            [req.user.id]
        );

        // Populate Care Team details for each patient
        // Note: Doing this in a loop for simplicity in prototype, but could be a JOIN
        const patients = result.rows;

        for (let patient of patients) {
            // Fetch Care Team
            const team = await pool.query(
                `SELECT DISTINCT ON (u.user_id) 
                 u.user_id, u.first_name, u.last_name, u.email, u.role, pa.relationship, pa.access_level
                 FROM patient_access pa
                 JOIN users u ON pa.user_id = u.user_id
                 WHERE pa.patient_id = $1
                 ORDER BY u.user_id, pa.access_level ASC`, // Deduplicate users if multiple roles exist
                [patient.patient_id]
            );
            patient.care_team = team.rows;
        }

        res.json({ success: true, data: patients });
    } catch (err) {
        console.error("Get Assignments Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// ==========================================
// 2. INVITE CAREGIVER (Grant Access)
// ==========================================
router.post('/caregiver/invite', async (req, res) => {
    const client = await pool.connect();
    try {
        const { patient_id, invite_email, relationship, access_level } = req.body;

        // [OWASP A01] Access Control Check
        // Only 'Primary Caregiver' or 'Edit' level can invite others
        const authCheck = await client.query(
            `SELECT access_level FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
            [req.user.id, patient_id]
        );

        if (authCheck.rows.length === 0 || (authCheck.rows[0].access_level !== 'Edit' && authCheck.rows[0].access_level !== 'Admin')) {
            return res.status(403).json({ success: false, message: 'Unauthorized: You do not have permission to invite caregivers.' });
        }

        // Find Target User
        const targetUser = await client.query("SELECT user_id FROM users WHERE email = $1", [invite_email]);
        if (targetUser.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User with this email not found.' });
        }
        const targetUserId = targetUser.rows[0].user_id;

        // Check if already assigned
        const exists = await client.query(
            "SELECT * FROM patient_access WHERE user_id = $1 AND patient_id = $2",
            [targetUserId, patient_id]
        );
        if (exists.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'User is already part of the care team.' });
        }

        await client.query('BEGIN');

        // Insert Access
        await client.query(
            `INSERT INTO patient_access (user_id, patient_id, relationship, access_level)
             VALUES ($1, $2, $3, $4)`,
            [targetUserId, patient_id, relationship || 'Secondary Caregiver', access_level || 'View']
        );

        // [Compliance] Audit Log
        await client.query(
            `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected) 
             VALUES ($1, $2, 'CAREGIVER_INVITE', $3)`,
            [req.user.id, patient_id, `Invited ${invite_email} as ${relationship}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Access granted to ${invite_email}` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Invite Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to invite caregiver' });
    } finally {
        client.release();
    }
});

// ==========================================
// 3. REVOKE ACCESS
// ==========================================
router.delete('/caregiver/revoke', async (req, res) => {
    const client = await pool.connect();
    try {
        const { patient_id, target_user_id } = req.body;

        // [OWASP A01] Security Check
        const authCheck = await client.query(
            `SELECT access_level FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
            [req.user.id, patient_id]
        );

        if (authCheck.rows.length === 0 || authCheck.rows[0].access_level !== 'Edit') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Prevent self-revocation if you are the only Primary (Edge case handling omitted for prototype simplicity)

        await client.query('BEGIN');

        await client.query(
            "DELETE FROM patient_access WHERE user_id = $1 AND patient_id = $2",
            [target_user_id, patient_id]
        );

        // Audit
        await client.query(
            `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected) 
             VALUES ($1, $2, 'CAREGIVER_REVOKE', $3)`,
            [req.user.id, patient_id, `Revoked access for UserID ${target_user_id}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Caregiver access revoked.' });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 4. LINK DEVICE
// ==========================================
router.post('/device/link', async (req, res) => {
    const client = await pool.connect();
    try {
        const { patient_id, serial_number } = req.body;

        // Security Check
        const authCheck = await client.query(
            `SELECT access_level FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
            [req.user.id, patient_id]
        );
        if (authCheck.rows.length === 0 || authCheck.rows[0].access_level !== 'Edit') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await client.query('BEGIN');

        // Check if device is free
        const devCheck = await client.query("SELECT assigned_patient_id FROM device_whitelist WHERE serial_number = $1", [serial_number]);
        if (devCheck.rows.length === 0) {
            throw new Error("Device not found in whitelist.");
        }
        if (devCheck.rows[0].assigned_patient_id) {
            throw new Error("Device is already assigned to another patient.");
        }

        // Link
        await client.query(
            "UPDATE device_whitelist SET assigned_patient_id = $1, status = 'ACTIVE' WHERE serial_number = $2",
            [patient_id, serial_number]
        );
        await client.query(
            "UPDATE patients SET device_serial_number = $1 WHERE patient_id = $2",
            [serial_number, patient_id]
        );

        // Audit
        await client.query(
            `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected) 
             VALUES ($1, $2, 'DEVICE_LINK', $3)`,
            [req.user.id, patient_id, `Linked Device ${serial_number}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Device linked successfully.' });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// 5. UNLINK DEVICE
// ==========================================
router.post('/device/unlink', async (req, res) => {
    const client = await pool.connect();
    try {
        const { patient_id, serial_number } = req.body;

        // Security Check
        const authCheck = await client.query(
            `SELECT access_level FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
            [req.user.id, patient_id]
        );
        if (authCheck.rows.length === 0 || authCheck.rows[0].access_level !== 'Edit') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await client.query('BEGIN');

        await client.query(
            "UPDATE device_whitelist SET assigned_patient_id = NULL, status = 'MAINTENANCE' WHERE serial_number = $1",
            [serial_number]
        );
        await client.query(
            "UPDATE patients SET device_serial_number = NULL WHERE patient_id = $1 AND device_serial_number = $2",
            [patient_id, serial_number]
        );

        // Audit
        await client.query(
            `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected) 
             VALUES ($1, $2, 'DEVICE_UNLINK', $3)`,
            [req.user.id, patient_id, `Unlinked Device ${serial_number}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Device unlinked successfully.' });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;
