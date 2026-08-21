const router = require('express').Router();
const pool = require('../db');
const { verifyToken, verifyFacilityAdmin } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

// Apply security middleware to ALL routes in this file
// [OWASP A01] Every route requires a valid JWT + facility_admin role
router.use(verifyToken);
router.use(verifyFacilityAdmin);

// =================================================================
// MODULE A: FACILITY DASHBOARD STATS
// Mandate: Row-Level Security — all queries scoped to facility_id
// =================================================================
router.get('/stats', async (req, res) => {
    const facilityId = req.user.facility_id;
    const isSysAdmin = req.user.is_sys_admin_override;
    try {
        if (isSysAdmin) {
            // [Omniscient View] System Admin: aggregate stats across ALL facilities
            const [sensorStats, batteryWarnings, pendingStaff] = await Promise.all([
                pool.query(`SELECT COUNT(*) FILTER (WHERE status = 'ACTIVE') AS online_count, COUNT(*) FILTER (WHERE status != 'ACTIVE') AS offline_count FROM device_whitelist`),
                pool.query(`SELECT dw.serial_number, dw.device_name, dw.battery_level, p.first_name, p.last_name FROM device_whitelist dw JOIN patients p ON dw.assigned_patient_id = p.patient_id WHERE dw.battery_level IS NOT NULL AND dw.battery_level < 20 ORDER BY dw.battery_level ASC LIMIT 20`),
                pool.query(`SELECT COUNT(*) FROM users WHERE account_status = 'Pending_Review'`)
            ]);
            return res.json({
                success: true,
                data: {
                    online_sensors: parseInt(sensorStats.rows[0].online_count),
                    offline_sensors: parseInt(sensorStats.rows[0].offline_count),
                    battery_warnings: batteryWarnings.rows,
                    pending_staff: parseInt(pendingStaff.rows[0].count)
                }
            });
        }

        const [sensorStats, batteryWarnings, pendingStaff] = await Promise.all([
            // [RLS] Count sensors only for this facility's patients
            pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE dw.status = 'ACTIVE') AS online_count,
                    COUNT(*) FILTER (WHERE dw.status != 'ACTIVE') AS offline_count
                 FROM device_whitelist dw
                 JOIN patients p ON dw.assigned_patient_id = p.patient_id
                 WHERE p.facility_id = $1`,
                [facilityId]
            ),
            // [RLS] Battery warnings for this facility's devices
            pool.query(
                `SELECT dw.serial_number, dw.device_name, dw.battery_level,
                        p.first_name, p.last_name
                 FROM device_whitelist dw
                 JOIN patients p ON dw.assigned_patient_id = p.patient_id
                 WHERE p.facility_id = $1
                   AND dw.battery_level IS NOT NULL
                   AND dw.battery_level < 20
                 ORDER BY dw.battery_level ASC`,
                [facilityId]
            ),
            // Pending staff approval for this facility
            pool.query(
                `SELECT COUNT(*) FROM users
                 WHERE facility_id = $1 AND account_status = 'Pending_Review'`,
                [facilityId]
            )
        ]);

        res.json({
            success: true,
            data: {
                online_sensors: parseInt(sensorStats.rows[0].online_count),
                offline_sensors: parseInt(sensorStats.rows[0].offline_count),
                battery_warnings: batteryWarnings.rows,
                pending_staff: parseInt(pendingStaff.rows[0].count)
            }
        });
    } catch (err) {
        // [OWASP A10] Generic error — no stack trace to frontend
        res.status(500).json({ success: false, message: 'Failed to fetch facility stats.' });
    }
});

// =================================================================
// MODULE B: WARD STAFF MANAGEMENT
// Mandate: HIPAA Workforce Security — scoped to facility
// =================================================================

// Get all staff in this facility (with online/offline status)
router.get('/staff', async (req, res) => {
    const facilityId = req.user.facility_id;
    const isSysAdmin = req.user.is_sys_admin_override;
    try {
        let result;
        if (isSysAdmin) {
            // [Omniscient View] System Admin sees ALL staff across all facilities
            result = await pool.query(
                `SELECT user_id, username, email, role, account_status, is_locked,
                        to_char(created_at, 'YYYY-MM-DD') as joined_at,
                        last_activity_at,
                        CASE WHEN last_activity_at > NOW() - INTERVAL '2 minutes' THEN true ELSE false END as is_online
                 FROM users
                 WHERE role IN ('caregiver', 'medical_staff', 'facility_admin')
                 ORDER BY created_at DESC`
            );
        } else {
            // [Privacy] No password_hash returned
            result = await pool.query(
                `SELECT user_id, username, email, role, account_status, is_locked,
                        to_char(created_at, 'YYYY-MM-DD') as joined_at,
                        last_activity_at,
                        CASE WHEN last_activity_at > NOW() - INTERVAL '2 minutes' THEN true ELSE false END as is_online
                 FROM users
                 WHERE facility_id = $1 AND role IN ('caregiver', 'medical_staff')
                 ORDER BY created_at DESC`,
                [facilityId]
            );
        }
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch staff list.' });
    }
});

// Invite new staff member to this facility
router.post('/staff/invite', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { email, role } = req.body;

    // [OWASP A01] Facility Admin can only assign caregiver or medical_staff roles
    const allowedRoles = ['caregiver', 'medical_staff'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role. You can only invite Caregivers or Medical Staff.' });
    }

    try {
        // Record the pending invitation
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'STAFF_INVITE_SENT', $2, 'INFO')`,
            [req.user.id, `Invite sent to ${email} for role ${role} in Facility ${facilityId}`]
        );
        // Note: Actual email sending requires the SMTP gateway (System Admin config)
        res.json({ success: true, message: `Invitation logged for ${email}. Email delivery requires SMTP configuration by System Admin.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to process invitation.' });
    }
});

// Securely provision new staff (replaces mock creation)
// [OWASP A04] Uses bcryptjs with salt rounds >= 12
router.post('/staff', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { username, email, role, password } = req.body;

    const allowedRoles = ['caregiver', 'medical_staff'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role. Facilities can only create Caregivers or Medical Staff.' });
    }

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'Username, email, and password are required.' });
    }

    try {
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, role, facility_id, account_status)
             VALUES ($1, $2, $3, $4, $5, 'Active')
             RETURNING user_id`,
            [username, email, hashedPassword, role, facilityId]
        );
        const newUserId = result.rows[0].user_id;

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'STAFF_PROVISIONED', $2, 'INFO')`,
            [req.user.id, `Created ${role} (ID ${newUserId}) in Facility ${facilityId}`]
        );

        res.status(201).json({ success: true, message: 'Staff member provisioned successfully.', user_id: newUserId });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'Username or email already exists.' });
        }
        res.status(500).json({ success: false, message: 'Failed to provision staff.' });
    }
});

// Remove staff member from facility
router.delete('/staff/:id', async (req, res) => {
    const facilityId = req.user.facility_id;
    const targetUserId = parseInt(req.params.id);

    try {
        const ownerCheck = await pool.query(
            'SELECT user_id, username FROM users WHERE user_id = $1 AND facility_id = $2',
            [targetUserId, facilityId]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'User does not belong to your facility.' });
        }

        await pool.query('DELETE FROM users WHERE user_id = $1', [targetUserId]);

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'STAFF_DELETED', $2, 'CRITICAL')`,
            [req.user.id, `Deleted staff member: ${ownerCheck.rows[0].username} (ID ${targetUserId})`]
        );

        res.json({ success: true, message: 'Staff member removed successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to remove staff member.' });
    }
});

// Get per-user permission overrides for facility staff
router.get('/staff/:userId/overrides', async (req, res) => {
    const facilityId = req.user.facility_id;
    const isSysAdmin = req.user.is_sys_admin_override;
    const targetUserId = parseInt(req.params.userId);

    try {
        // [OWASP A01 / HIPAA Minimum Necessary] Facility admins may only view overrides
        // for users within their own facility. SysAdmins have global read access.
        if (!isSysAdmin) {
            const ownerCheck = await pool.query(
                'SELECT user_id FROM users WHERE user_id = $1 AND facility_id = $2',
                [targetUserId, facilityId]
            );
            if (ownerCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Unauthorized: User does not belong to your facility.' });
            }
        }

        const result = await pool.query(
            'SELECT module_id, is_granted, override_reason, overridden_at FROM user_permission_overrides WHERE user_id = $1',
            [targetUserId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch overrides.' });
    }
});

// Set a per-user module override for facility staff
router.post('/staff/:userId/overrides', async (req, res) => {
    const facilityId = req.user.facility_id;
    const isSysAdmin = req.user.is_sys_admin_override;
    const targetUserId = parseInt(req.params.userId);
    const { module_id, is_granted, override_reason } = req.body;

    if (!override_reason || override_reason.trim() === '') {
        return res.status(400).json({ success: false, message: 'A reason is required for all permission overrides.' });
    }

    try {
        // [OWASP A01] Facility admins are scoped to their own facility.
        // SysAdmins bypass the facility ownership check — they manage overrides globally.
        if (!isSysAdmin) {
            const ownerCheck = await pool.query(
                'SELECT user_id FROM users WHERE user_id = $1 AND facility_id = $2',
                [targetUserId, facilityId]
            );
            if (ownerCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Unauthorized: User does not belong to your facility.' });
            }
        }

        await pool.query(
            `INSERT INTO user_permission_overrides (user_id, module_id, is_granted, override_reason, overridden_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, module_id) DO UPDATE
             SET is_granted = $3, override_reason = $4, overridden_by = $5, overridden_at = NOW()`,
            [targetUserId, module_id, is_granted, override_reason, req.user.id]
        );
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'FACILITY_RBAC_OVERRIDE_SET', $2, 'WARNING')`,
            [req.user.id, `Override for User ${targetUserId}, module ${module_id}: ${is_granted ? 'GRANTED' : 'DENIED'}. Reason: ${override_reason}`]
        );
        res.json({ success: true, message: 'Permission override saved.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to save override.' });
    }
});

// Remove a specific override
router.delete('/staff/:userId/overrides/:moduleId', async (req, res) => {
    const facilityId = req.user.facility_id;
    const isSysAdmin = req.user.is_sys_admin_override;
    const targetUserId = parseInt(req.params.userId);
    const { moduleId } = req.params;

    try {
        // [OWASP A01] SysAdmins bypass facility ownership check — they reset overrides globally.
        if (!isSysAdmin) {
            const ownerCheck = await pool.query(
                'SELECT user_id FROM users WHERE user_id = $1 AND facility_id = $2',
                [targetUserId, facilityId]
            );
            if (ownerCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Unauthorized: User does not belong to your facility.' });
            }
        }

        await pool.query(
            'DELETE FROM user_permission_overrides WHERE user_id = $1 AND module_id = $2',
            [targetUserId, moduleId]
        );
        res.json({ success: true, message: 'Override removed. User will now follow role defaults.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to remove override.' });
    }
});

// Instantly revoke a staff member's active sessions (local kill switch)
router.post('/staff/:id/revoke-session', async (req, res) => {
    const facilityId = req.user.facility_id;
    const targetUserId = parseInt(req.params.id);

    try {
        // [OWASP A01] Verify the target user actually belongs to THIS facility
        const ownerCheck = await pool.query(
            'SELECT user_id FROM users WHERE user_id = $1 AND facility_id = $2',
            [targetUserId, facilityId]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Access Denied: User does not belong to your facility.' });
        }

        // Write revocation record — verifyToken will reject the user's next request
        await pool.query(
            `INSERT INTO session_revocations (user_id, revoked_before, revoked_by, reason)
             VALUES ($1, NOW(), $2, 'Revoked by Facility Admin')
             ON CONFLICT (user_id) DO UPDATE SET revoked_before = NOW(), revoked_by = $2`,
            [targetUserId, req.user.id]
        );

        // Clear activity timestamp so status immediately shows Offline
        await pool.query('UPDATE users SET last_activity_at = NULL WHERE user_id = $1', [targetUserId]);

        // [OWASP A09] Audit the action
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'SESSION_REVOKE', $2, 'CRITICAL')`,
            [req.user.id, `Revoked sessions for User ID ${targetUserId}`]
        );

        res.json({ success: true, message: 'User sessions have been revoked. They will be logged out on their next action.' });
    } catch (err) {
        console.error('Revoke session error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to revoke sessions.' });
    }
});

// Lock a staff account immediately (prevents login + revokes active sessions)
// [OWASP A07] Emergency response for compromised accounts
router.post('/staff/:id/lock-account', async (req, res) => {
    const facilityId = req.user.facility_id;
    const targetUserId = parseInt(req.params.id);

    try {
        const ownerCheck = await pool.query(
            'SELECT user_id, is_locked FROM users WHERE user_id = $1 AND facility_id = $2',
            [targetUserId, facilityId]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'User does not belong to your facility.' });
        }
        if (ownerCheck.rows[0].is_locked) {
            return res.json({ success: true, message: 'Account is already locked.' });
        }

        // Lock the account and clear activity so status shows Locked immediately
        await pool.query('UPDATE users SET is_locked = true, last_activity_at = NULL WHERE user_id = $1', [targetUserId]);

        // Also revoke all active sessions so the user is kicked out immediately
        await pool.query(
            `INSERT INTO session_revocations (user_id, revoked_before, revoked_by, reason)
             VALUES ($1, NOW(), $2, 'Account locked by Facility Admin')
             ON CONFLICT (user_id) DO UPDATE SET revoked_before = NOW(), revoked_by = $2`,
            [targetUserId, req.user.id]
        );

        // [OWASP A09] Critical audit trail
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'ACCOUNT_LOCK', $2, 'CRITICAL')`,
            [req.user.id, `Locked account for User ID ${targetUserId}`]
        );

        res.json({ success: true, message: 'Account locked. User has been logged out and cannot log in until unlocked.' });
    } catch (err) {
        console.error('Lock account error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to lock account.' });
    }
});

// Unlock a staff account
router.post('/staff/:id/unlock-account', async (req, res) => {
    const facilityId = req.user.facility_id;
    const targetUserId = parseInt(req.params.id);

    try {
        const ownerCheck = await pool.query(
            'SELECT user_id FROM users WHERE user_id = $1 AND facility_id = $2',
            [targetUserId, facilityId]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'User does not belong to your facility.' });
        }

        await pool.query('UPDATE users SET is_locked = false WHERE user_id = $1', [targetUserId]);

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'ACCOUNT_UNLOCK', $2, 'WARNING')`,
            [req.user.id, `Unlocked account for User ID ${targetUserId}`]
        );

        res.json({ success: true, message: 'Account unlocked. User can now log in again.' });
    } catch (err) {
        console.error('Unlock account error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to unlock account.' });
    }
});

// Assign caregiver to a patient (via patient_access table)
// [OWASP A01 / IDOR] Both patient and caregiver must belong to this facility
router.put('/patients/:patientId/assign-staff', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { patientId } = req.params;
    const { caregiver_id } = req.body;

    try {
        // [OWASP A01 / IDOR] Verify both patient and caregiver belong to this facility
        const [patientCheck, caregiverCheck] = await Promise.all([
            pool.query('SELECT patient_id FROM patients WHERE patient_id = $1 AND facility_id = $2', [patientId, facilityId]),
            pool.query('SELECT user_id FROM users WHERE user_id = $1 AND facility_id = $2', [caregiver_id, facilityId])
        ]);

        if (patientCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Patient not found in your facility.' });
        }
        if (caregiverCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Caregiver not found in your facility.' });
        }

        // Check if this exact assignment already exists
        const existingCheck = await pool.query(
            `SELECT access_id FROM patient_access
             WHERE user_id = $1 AND patient_id = $2 AND relationship = 'Assigned Caregiver'`,
            [caregiver_id, patientId]
        );
        if (existingCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'This patient is already assigned to that caregiver.'
            });
        }

        // [OWASP A05] Insert the new assignment (multiple caregivers allowed for shift coverage)
        // Starts in 'Pending' status so caregiver can Accept or Decline.
        await pool.query(
            `INSERT INTO patient_access (user_id, patient_id, relationship, access_level, invite_status, invited_by)
             VALUES ($1, $2, 'Assigned Caregiver', 'Full', 'Pending', $3)`,
            [caregiver_id, patientId, req.user.id]
        );

        // [OWASP A09] Audit trail
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected)
             VALUES ($1, 'PATIENT_STAFF_ASSIGN', $2)`,
            [req.user.id, `Assigned Caregiver ${caregiver_id} to Patient ${patientId}`]
        );

        res.json({ success: true, message: 'Caregiver assigned to patient successfully.' });
    } catch (err) {
        console.error('Assignment error:', err.message);
        res.status(500).json({ success: false, message: 'Assignment failed.' });
    }
});

// Remove a specific caregiver from a patient
// [OWASP A01 / IDOR] Patient must belong to this facility
router.delete('/patients/:patientId/unassign-staff', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { patientId } = req.params;
    const { caregiver_id } = req.body;

    if (!caregiver_id) {
        return res.status(400).json({ success: false, message: 'Caregiver ID is required.' });
    }

    try {
        // Verify patient belongs to this facility
        const patientCheck = await pool.query(
            'SELECT patient_id FROM patients WHERE patient_id = $1 AND facility_id = $2',
            [patientId, facilityId]
        );
        if (patientCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Patient not found in your facility.' });
        }

        // Remove the specific caregiver assignment
        const result = await pool.query(
            `DELETE FROM patient_access
             WHERE patient_id = $1 AND user_id = $2 AND relationship = 'Assigned Caregiver'`,
            [patientId, caregiver_id]
        );

        if (result.rowCount === 0) {
            return res.json({ success: true, message: 'That caregiver was not assigned to this patient.' });
        }

        // [OWASP A09] Audit trail
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'PATIENT_STAFF_UNASSIGN', $2, 'WARNING')`,
            [req.user.id, `Removed Caregiver ${caregiver_id} from Patient ${patientId}`]
        );

        res.json({ success: true, message: 'Caregiver has been unassigned from this patient.' });
    } catch (err) {
        console.error('Unassign error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to unassign caregiver.' });
    }
});

// =================================================================
// MODULE C: PATIENT ONBOARDING
// Mandate: DPA § Informed Consent before data collection begins
// =================================================================

// Get all patients in this facility with their assigned caregivers (supports multiple)
// [OWASP A05] Parameterized query | [RLS] Scoped to facility_id
router.get('/patients', async (req, res) => {
    const facilityId = req.user.facility_id;
    try {
        // Aggregate multiple caregivers per patient into a JSON array
        const result = await pool.query(
            `SELECT p.patient_id, p.name AS patient_name,
                    COALESCE(
                        json_agg(
                            json_build_object('user_id', pa.user_id, 'username', u.username, 'invite_status', pa.invite_status)
                        ) FILTER (WHERE pa.user_id IS NOT NULL),
                        '[]'::json
                    ) AS caregivers
             FROM patients p
             LEFT JOIN patient_access pa ON p.patient_id = pa.patient_id
                 AND pa.relationship = 'Assigned Caregiver'
             LEFT JOIN users u ON pa.user_id = u.user_id
             WHERE p.facility_id = $1
             GROUP BY p.patient_id, p.name
             ORDER BY p.name ASC`,
            [facilityId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        // [OWASP A10] Generic error message — no stack trace leaked
        res.status(500).json({ success: false, message: 'Failed to fetch patient list.' });
    }
});

// Create new patient with consent verification
router.post('/patients', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { first_name, last_name, age, gender, diagnosis, consent_confirmed } = req.body;

    // [DPA 2012 § 13] Informed consent is mandatory before creating a health record
    if (!consent_confirmed) {
        return res.status(400).json({
            success: false,
            message: 'Informed consent must be confirmed before patient registration can proceed. (DPA § 13)'
        });
    }

    try {
        // [OWASP A05] Parameterized insert
        const result = await pool.query(
            `INSERT INTO patients (first_name, last_name, age, gender, diagnosis, facility_id, consent_collected_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
             RETURNING patient_id`,
            [first_name, last_name, age, gender, diagnosis, facilityId, req.user.id]
        );
        const newPatientId = result.rows[0].patient_id;

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'PATIENT_CREATE', $2, 'INFO')`,
            [req.user.id, `Created Patient ID ${newPatientId} in Facility ${facilityId}`]
        );

        res.status(201).json({ success: true, message: 'Patient registered successfully.', patient_id: newPatientId });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to register patient.' });
    }
});

// Pair an ESP32 device to a patient
router.post('/patients/:patientId/pair-device', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { patientId } = req.params;
    const { serial_number } = req.body;

    try {
        // [OWASP A01 / IDOR] Verify patient belongs to this facility
        const patientCheck = await pool.query(
            'SELECT patient_id FROM patients WHERE patient_id = $1 AND facility_id = $2',
            [patientId, facilityId]
        );
        if (patientCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Patient not found in your facility.' });
        }

        // Check device is whitelisted
        const deviceCheck = await pool.query(
            "SELECT serial_number FROM device_whitelist WHERE serial_number = $1 AND status = 'ACTIVE'",
            [serial_number]
        );
        if (deviceCheck.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Device not found or not active in whitelist. Contact System Admin.' });
        }

        await pool.query(
            'UPDATE device_whitelist SET assigned_patient_id = $1 WHERE serial_number = $2',
            [patientId, serial_number]
        );
        await pool.query(
            'UPDATE patients SET device_serial_number = $1 WHERE patient_id = $2',
            [serial_number, patientId]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected)
             VALUES ($1, 'DEVICE_PAIR', $2)`,
            [req.user.id, `Paired device ${serial_number} to Patient ${patientId}`]
        );

        res.json({ success: true, message: 'Device paired to patient successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Device pairing failed.' });
    }
});

// Reset SVM baseline for a patient
router.post('/patients/:patientId/reset-baseline', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { patientId } = req.params;
    const { reason } = req.body;

    try {
        const patientCheck = await pool.query(
            'SELECT patient_id FROM patients WHERE patient_id = $1 AND facility_id = $2',
            [patientId, facilityId]
        );
        if (patientCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Patient not found in your facility.' });
        }

        // Clear SVM training data for this patient
        await pool.query(
            'UPDATE patients SET svm_baseline_data = NULL, baseline_reset_at = NOW() WHERE patient_id = $1',
            [patientId]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'SVM_BASELINE_RESET', $2, 'WARNING')`,
            [req.user.id, `Reset SVM baseline for Patient ${patientId}. Reason: ${reason || 'Not provided'}`]
        );

        res.json({ success: true, message: 'SVM baseline has been cleared. The system will re-learn this patient\'s normal patterns.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Baseline reset failed.' });
    }
});

// =================================================================
// MODULE D: CLINICAL ALERT CONFIGURATION
// =================================================================

// Get current thresholds for this facility
router.get('/alerts/thresholds', async (req, res) => {
    const facilityId = req.user.facility_id;
    try {
        const result = await pool.query(
            `SELECT config_key, config_value FROM system_configs
             WHERE config_key LIKE $1`,
            [`facility_${facilityId}_%`]
        );
        const thresholds = {};
        result.rows.forEach(row => {
            // Strip the facility prefix from the key name for the frontend
            const key = row.config_key.replace(`facility_${facilityId}_`, '');
            thresholds[key] = row.config_value;
        });
        res.json({ success: true, data: thresholds });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch thresholds.' });
    }
});

// Update alert thresholds
router.put('/alerts/thresholds', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { spo2_min, heart_rate_min, heart_rate_max, moisture_sensitivity, escalation_path } = req.body;

    try {
        const configs = [
            [`facility_${facilityId}_spo2_min`, spo2_min],
            [`facility_${facilityId}_heart_rate_min`, heart_rate_min],
            [`facility_${facilityId}_heart_rate_max`, heart_rate_max],
            [`facility_${facilityId}_moisture_sensitivity`, moisture_sensitivity],
            [`facility_${facilityId}_escalation_path`, JSON.stringify(escalation_path)]
        ].filter(([, val]) => val !== undefined);

        for (const [key, value] of configs) {
            // [OWASP A05] Parameterized upsert
            await pool.query(
                `INSERT INTO system_configs (config_key, config_value, updated_by)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (config_key) DO UPDATE SET config_value = $2, updated_by = $3, updated_at = NOW()`,
                [key, String(value), req.user.id]
            );
        }

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'ALERT_THRESHOLD_UPDATE', $2, 'WARNING')`,
            [req.user.id, `Updated alert thresholds for Facility ${facilityId}`]
        );

        res.json({ success: true, message: 'Alert thresholds updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update thresholds.' });
    }
});

// =================================================================
// MODULE E: READ-ONLY DIAGNOSTICS
// Mandate: DPA — Strips ip_address and user_agent from patient access logs
// =================================================================

// Ping device to test signal (read-only, does not alter device config)
router.get('/diagnostics/ping/:serialNumber', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { serialNumber } = req.params;

    try {
        // [OWASP A01 / IDOR] Verify device belongs to a patient in this facility
        const deviceCheck = await pool.query(
            `SELECT dw.serial_number, dw.device_name, dw.status, dw.last_heartbeat,
                    p.first_name, p.last_name
             FROM device_whitelist dw
             JOIN patients p ON dw.assigned_patient_id = p.patient_id
             WHERE dw.serial_number = $1 AND p.facility_id = $2`,
            [serialNumber, facilityId]
        );

        if (deviceCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Device not found in your facility.' });
        }

        const device = deviceCheck.rows[0];
        const isOnline = device.last_heartbeat &&
            (new Date() - new Date(device.last_heartbeat)) < 60000; // Online if heartbeat < 60s ago

        res.json({
            success: true,
            data: {
                serial_number: device.serial_number,
                device_name: device.device_name,
                status: device.status,
                last_heartbeat: device.last_heartbeat,
                is_online: isOnline,
                patient: `${device.first_name} ${device.last_name}`
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Ping failed.' });
    }
});

// Patient record access log — DPA compliant (NO ip_address, NO user_agent)
router.get('/diagnostics/access-log', async (req, res) => {
    const facilityId = req.user.facility_id;
    try {
        // [DPA 2012 Proportionality] Facility Admin only needs WHO and WHEN
        // ip_address and user_agent are intentionally excluded
        const result = await pool.query(
            `SELECT
                a.log_id,
                u.username AS staff_name,
                u.role AS staff_role,
                a.action,
                a.resource_affected AS patient_viewed,
                to_char(a.timestamp, 'YYYY-MM-DD HH24:MI') AS access_time
             FROM access_logs a
             JOIN users u ON a.user_id = u.user_id
             WHERE u.facility_id = $1
               AND a.action IN ('PATIENT_VIEW', 'VITAL_SIGN_VIEW', 'PATIENT_UPDATE')
             ORDER BY a.timestamp DESC
             LIMIT 200`,
            [facilityId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch access log.' });
    }
});

module.exports = router;
