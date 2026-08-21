const router = require('express').Router();
const pool = require('../db');
const { verifyToken, enforceBreakGlassForSysAdmin } = require('../middleware/authMiddleware');

// Apply Security Middleware
router.use(verifyToken);
// [TECHNICAL DEBT] enforceBreakGlassForSysAdmin is disabled for development testing.
// MUST be re-enabled before production: router.use(enforceBreakGlassForSysAdmin);

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
                (SELECT COUNT(*) FROM patient_access WHERE patient_id = p.patient_id AND (invite_status = 'Active' OR invite_status IS NULL)) as care_team_count
             FROM patients p
             JOIN patient_access pa ON p.patient_id = pa.patient_id
             WHERE pa.user_id = $1
               AND p.is_archived IS DISTINCT FROM TRUE
               AND (pa.invite_status = 'Active' OR pa.invite_status IS NULL)
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
                   AND (pa.invite_status = 'Active' OR pa.invite_status IS NULL)
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
// 2. INVITE CAREGIVER (Grant Pending Access)
// [WORKFLOW] Creates a 'Pending' assignment record. The caregiver
// receives a notification in the mobile app and must Accept or Decline.
// Only after acceptance is the record promoted to 'Active'.
// ==========================================
router.post('/caregiver/invite', async (req, res) => {
    const client = await pool.connect();
    try {
        const { patient_id, invite_email, relationship, access_level } = req.body;

        // [OWASP A01] Access Control Check
        // Only 'Edit' or 'Admin' level can invite others
        const authCheck = await client.query(
            `SELECT pa.access_level, u.first_name, u.last_name
             FROM patient_access pa
             JOIN users u ON u.user_id = pa.user_id
             WHERE pa.user_id = $1 AND pa.patient_id = $2`,
            [req.user.id, patient_id]
        );

        if (authCheck.rows.length === 0 || (authCheck.rows[0].access_level !== 'Edit' && authCheck.rows[0].access_level !== 'Admin')) {
            return res.status(403).json({ success: false, message: 'Unauthorized: You do not have permission to invite caregivers.' });
        }

        // Fetch patient name for the notification message
        const patientRes = await client.query('SELECT name FROM patients WHERE patient_id = $1', [patient_id]);
        const patientName = patientRes.rows[0]?.name || 'a patient';

        // Find Target User
        const targetUser = await client.query("SELECT user_id, first_name FROM users WHERE email = $1", [invite_email]);
        if (targetUser.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User with this email not found.' });
        }
        const targetUserId = targetUser.rows[0].user_id;

        // Check if already assigned (Active or Pending)
        const exists = await client.query(
            "SELECT * FROM patient_access WHERE user_id = $1 AND patient_id = $2",
            [targetUserId, patient_id]
        );
        if (exists.rows.length > 0) {
            const existingStatus = exists.rows[0].invite_status || 'Active';
            if (existingStatus === 'Pending') {
                return res.status(400).json({ success: false, message: 'An invitation is already pending for this user.' });
            }
            return res.status(400).json({ success: false, message: 'User is already part of the care team.' });
        }

        await client.query('BEGIN');

        // [WORKFLOW] Insert as 'Pending' — requires caregiver acceptance
        // invited_by and invite_status columns are added via migration (see migration note below)
        await client.query(
            `INSERT INTO patient_access (user_id, patient_id, relationship, access_level, invite_status, invited_by)
             VALUES ($1, $2, $3, $4, 'Pending', $5)`,
            [targetUserId, patient_id, relationship || 'Secondary Caregiver', access_level || 'View', req.user.id]
        );

        // [HIPAA / Compliance] Audit Log
        await client.query(
            `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected) 
             VALUES ($1, $2, 'CAREGIVER_INVITE_PENDING', $3)`,
            [req.user.id, patient_id, `Invited ${invite_email} as ${relationship} — awaiting acceptance`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Invitation sent to ${invite_email}. Awaiting their acceptance.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Invite Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to send invitation' });
    } finally {
        client.release();
    }
});

// ==========================================
// 2a. GET PENDING INVITATIONS (for the logged-in caregiver)
// Called by the mobile app to poll for new assignment invitations.
// [OWASP A01] JWT-scoped — only returns invites for the requesting user.
// ==========================================
router.get('/pending-invites', async (req, res) => {
    try {
        // [OWASP A01] IDOR Protection: req.user.id is extracted from the verified JWT,
        // not from a user-supplied query parameter, preventing horizontal access.
        const result = await pool.query(
            `SELECT pa.access_id, pa.patient_id, p.name AS patient_name,
                    pa.relationship, pa.access_level, pa.assigned_at AS invited_at,
                    u.first_name AS invited_by_first_name, u.last_name AS invited_by_last_name
             FROM patient_access pa
             JOIN patients p ON p.patient_id = pa.patient_id
             LEFT JOIN users u ON u.user_id = pa.invited_by
             WHERE pa.user_id = $1
               AND pa.invite_status = 'Pending'
               AND p.is_archived IS DISTINCT FROM TRUE`,
            [req.user.id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Pending Invites Error:', err.message);
        // [OWASP A10] Generic error — no internal details exposed
        res.status(500).json({ success: false, message: 'Failed to fetch pending invitations.' });
    }
});

// ==========================================
// 2b. RESPOND TO INVITATION (Accept or Decline)
// [DPA Principle] The caregiver gives explicit, informed consent
// before their data is linked to a patient record.
// ==========================================
router.post('/respond-invite', async (req, res) => {
    const client = await pool.connect();
    try {
        const { access_id, action } = req.body; // action: 'accept' | 'decline'

        if (!['accept', 'decline'].includes(action)) {
            return res.status(400).json({ success: false, message: "Invalid action. Use 'accept' or 'decline'." });
        }

        // [OWASP A01] Confirm the invite belongs to the requesting user
        const invite = await client.query(
            `SELECT pa.access_id, pa.patient_id, pa.invited_by, pa.relationship
             FROM patient_access pa
             WHERE pa.access_id = $1 AND pa.user_id = $2 AND pa.invite_status = 'Pending'`,
            [access_id, req.user.id]
        );

        if (invite.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invitation not found or already responded to.' });
        }

        const { patient_id, relationship } = invite.rows[0];

        await client.query('BEGIN');

        if (action === 'accept') {
            // Promote status to 'Active' — caregiver now has access
            await client.query(
                `UPDATE patient_access SET invite_status = 'Active' WHERE access_id = $1`,
                [access_id]
            );

            // [HIPAA] Audit Trail — record acceptance with timestamp
            await client.query(
                `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected)
                 VALUES ($1, $2, 'CAREGIVER_INVITE_ACCEPTED', $3)`,
                [req.user.id, patient_id, `Caregiver accepted assignment as ${relationship}`]
            );
        } else {
            // Decline — update status to 'Declined'
            await client.query(
                `UPDATE patient_access SET invite_status = 'Declined' WHERE access_id = $1`,
                [access_id]
            );

            // [HIPAA] Audit Trail — record decline
            await client.query(
                `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected)
                 VALUES ($1, $2, 'CAREGIVER_INVITE_DECLINED', $3)`,
                [req.user.id, patient_id, `Caregiver declined assignment as ${relationship}`]
            );
        }

        await client.query('COMMIT');
        const message = action === 'accept'
            ? 'You have accepted the assignment. The patient is now in your care list.'
            : 'You have declined the assignment invitation.';
        res.json({ success: true, message });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Respond Invite Error:', err.message);
        // [OWASP A10] Generic error message
        res.status(500).json({ success: false, message: 'Failed to process your response.' });
    } finally {
        client.release();
    }
});

// ==========================================
// 3. REVOKE ACCESS (Admin removes another caregiver)
// ==========================================
router.delete('/caregiver/revoke', async (req, res) => {
    const client = await pool.connect();
    try {
        const { patient_id, target_user_id } = req.body;

        // [OWASP A01] Security Check — requester must be Edit or Admin level
        const authCheck = await client.query(
            `SELECT access_level FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
            [req.user.id, patient_id]
        );

        if (authCheck.rows.length === 0 || (authCheck.rows[0].access_level !== 'Edit' && authCheck.rows[0].access_level !== 'Admin')) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Prevent the admin from revoking themselves via this route (use self-remove instead)
        if (parseInt(target_user_id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'To remove yourself, use the self-remove option on your assignment card.' });
        }

        await client.query('BEGIN');

        await client.query(
            "DELETE FROM patient_access WHERE user_id = $1 AND patient_id = $2",
            [target_user_id, patient_id]
        );

        // [HIPAA] Audit trail
        await client.query(
            `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected) 
             VALUES ($1, $2, 'CAREGIVER_REVOKE', $3)`,
            [req.user.id, patient_id, `Revoked access for UserID ${target_user_id}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Caregiver access revoked.' });

    } catch (err) {
        await client.query('ROLLBACK');
        // [OWASP A10] Generic error — no stack trace exposed
        res.status(500).json({ success: false, message: 'Failed to revoke access.' });
    } finally {
        client.release();
    }
});

// ==========================================
// 3a. SELF-REMOVE FROM ASSIGNMENT
// [DPA] Supports the Data Subject's right to withdraw from a care role.
// A caregiver can remove themselves from any patient they are assigned to.
// ==========================================
router.delete('/caregiver/self-remove', async (req, res) => {
    const client = await pool.connect();
    try {
        const { patient_id } = req.body;

        // [OWASP A01] Only the authenticated user can remove themselves
        const exists = await client.query(
            `SELECT access_id, access_level FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
            [req.user.id, patient_id]
        );

        if (exists.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'You are not assigned to this patient.' });
        }

        await client.query('BEGIN');

        await client.query(
            `DELETE FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
            [req.user.id, patient_id]
        );

        // [HIPAA] Audit Trail — record voluntary withdrawal
        await client.query(
            `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected)
             VALUES ($1, $2, 'CAREGIVER_SELF_REMOVED', $3)`,
            [req.user.id, patient_id, `Caregiver voluntarily removed themselves from patient care team`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'You have been removed from this patient assignment.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Self-Remove Error:', err.message);
        // [OWASP A10] Generic error — no stack trace exposed
        res.status(500).json({ success: false, message: 'Failed to remove assignment.' });
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

// ==========================================
// 6. UPDATE CAREGIVER PERMISSIONS
// ==========================================
router.put('/caregiver/permissions', async (req, res) => {
    const client = await pool.connect();
    try {
        const { patient_id, target_user_id, relationship, access_level } = req.body;

        // [OWASP A01] Security Check
        const authCheck = await client.query(
            `SELECT access_level FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
            [req.user.id, patient_id]
        );
        if (authCheck.rows.length === 0 || (authCheck.rows[0].access_level !== 'Edit' && authCheck.rows[0].access_level !== 'Admin')) {
            return res.status(403).json({ success: false, message: 'Unauthorized: Insufficient permissions.' });
        }

        // Prevent modifying own permissions to avoid lockout (e.g., Edit -> View)
        if (parseInt(target_user_id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'You cannot modify your own permissions.' });
        }

        await client.query('BEGIN');

        // Update Access
        const updateRes = await client.query(
            `UPDATE patient_access 
             SET relationship = $1, access_level = $2
             WHERE user_id = $3 AND patient_id = $4
             RETURNING *`,
            [relationship, access_level, target_user_id, patient_id]
        );

        if (updateRes.rowCount === 0) {
            throw new Error("Target caregiver not found.");
        }

        // [Compliance] Audit Log
        await client.query(
            `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected) 
             VALUES ($1, $2, 'CAREGIVER_UPDATE', $3)`,
            [req.user.id, patient_id, `Updated UserID ${target_user_id} to ${access_level}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Permissions updated successfully.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Permission Update Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to update permissions' });
    } finally {
        client.release();
    }
});

// ==========================================
// 7. GET ACTIVITY LOG
// ==========================================
router.get('/caregiver/activity-log/:patient_id', async (req, res) => {
    try {
        const { patient_id } = req.params;

        // [OWASP A01] Security Check
        const authCheck = await pool.query(
            `SELECT access_level FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
            [req.user.id, patient_id]
        );

        // Allow 'View' access to see logs? Or limit to 'Edit'? 
        // Decision: Let's restrict to 'Edit'/'Admin' to protect caregiver privacy (e.g. knowing who logged in when).
        if (authCheck.rows.length === 0 || (authCheck.rows[0].access_level !== 'Edit' && authCheck.rows[0].access_level !== 'Admin')) {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        const stats = await pool.query(
            `SELECT al.log_id, al.action, al.resource_affected as details, al.timestamp,
                    u.first_name, u.last_name, u.email
             FROM access_logs al
             JOIN users u ON al.user_id = u.user_id
             WHERE al.target_patient_id = $1
             ORDER BY al.timestamp DESC
             LIMIT 50`, // Pagination can be added later
            [patient_id]
        );

        res.json({ success: true, data: stats.rows });

    } catch (err) {
        console.error("Activity Log Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// ==========================================
// 8. GET CAREGIVER TEAM
// ==========================================
router.get('/caregiver/team/:patient_id', async (req, res) => {
    try {
        const { patient_id } = req.params;

        // [OWASP A01] Security Check
        const authCheck = await pool.query(
            `SELECT access_level FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
            [req.user.id, patient_id]
        );

        if (authCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        const team = await pool.query(
            `SELECT DISTINCT ON (u.user_id) 
             u.user_id, u.first_name, u.last_name, u.email, u.role, pa.relationship, pa.access_level
             FROM patient_access pa
             JOIN users u ON pa.user_id = u.user_id
             WHERE pa.patient_id = $1
             ORDER BY u.user_id, pa.access_level ASC`,
            [patient_id]
        );

        res.json({ success: true, data: team.rows });

    } catch (err) {
        console.error("Get Team Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;
