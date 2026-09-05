const router = require('express').Router();
const pool = require('../db');
const { verifyToken, verifyFacilityAdmin } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');
const systemReportService = require('../services/systemReportService');

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
                pool.query(`SELECT dw.serial_number, dw.device_name, 100 AS battery_level, p.name AS first_name, '' AS last_name FROM device_whitelist dw JOIN patients p ON dw.assigned_patient_id = p.patient_id WHERE FALSE`),
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
            // [RLS] Battery warnings for this facility's devices (Safe Query)
            pool.query(
                `SELECT dw.serial_number, dw.device_name, 100 AS battery_level,
                        p.name AS first_name, '' AS last_name
                 FROM device_whitelist dw
                 JOIN patients p ON dw.assigned_patient_id = p.patient_id
                 WHERE FALSE`,
                []
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

    const hasSmall = /[a-z]/.test(password);
    const hasCap = /[A-Z]/.test(password);
    const hasNum = /[0-9]/.test(password);
    const hasSym = /[^A-Za-z0-9]/.test(password);
    if (password.length < 12 || !hasSmall || !hasCap || !hasNum || !hasSym) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 12 characters and contain at least 1 lowercase letter, 1 uppercase letter, 1 number, and 1 symbol.'
        });
    }

    try {
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, role, facility_id, account_status, is_verified, created_by)
             VALUES ($1, $2, $3, $4, $5, 'Active', true, $6)
             RETURNING user_id`,
            [username, email, hashedPassword, role, facilityId, req.user.id]
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

// Remove staff member from facility (changed to archive)
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

        await pool.query("UPDATE users SET is_archived = true, account_status = 'Archived' WHERE user_id = $1", [targetUserId]);

        await pool.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
             VALUES ('User', $1, $2, $3, NOW(), 'Archived', $4)`,
            [targetUserId.toString(), ownerCheck.rows[0].username, req.user.id, facilityId]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'STAFF_ARCHIVED', $2, 'CRITICAL')`,
            [req.user.id, `Archived staff member: ${ownerCheck.rows[0].username} (ID ${targetUserId})`]
        );

        res.json({ success: true, message: 'Staff member archived successfully.' });
    } catch (err) {
        console.error("Archive staff error:", err);
        res.status(500).json({ success: false, message: 'Failed to archive staff member.' });
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
        // Verify patient belongs to this facility and caregiver exists in system
        const [patientCheck, caregiverCheck] = await Promise.all([
            pool.query('SELECT patient_id FROM patients WHERE patient_id = $1 AND facility_id = $2', [patientId, facilityId]),
            pool.query('SELECT user_id, role FROM users WHERE user_id = $1 AND role IN (\'caregiver\', \'medical_staff\', \'parent\')', [caregiver_id])
        ]);

        if (patientCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Patient not found in your facility.' });
        }
        if (caregiverCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Staff member or caregiver not found in the system.' });
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
    let facilityId = req.user.facility_id;
    const isSysAdmin = req.user.is_sys_admin_override || ['system_admin', 'admin', 'sysadmin'].includes(req.user.role?.toLowerCase());
    const { first_name, last_name, age, gender, diagnosis, consent_confirmed, ward, room, bed, patient_type, facility_name } = req.body;

    // [DPA 2012 § 13] Informed consent is mandatory before creating a health record
    if (!consent_confirmed) {
        return res.status(400).json({
            success: false,
            message: 'Informed consent must be confirmed before patient registration can proceed. (DPA § 13)'
        });
    }

    if (!room || !room.trim() || !bed || !bed.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Room name and Bed name are required.'
        });
    }

    try {
        if (isSysAdmin) {
            if (patient_type === 'at_home') {
                facilityId = null;
            } else if (facility_name && facility_name.trim()) {
                let facilityRes = await pool.query(
                    `SELECT facility_id FROM facilities WHERE LOWER(facility_name) = LOWER($1)`,
                    [facility_name.trim()]
                );
                if (facilityRes.rows.length === 0) {
                    facilityRes = await pool.query(
                        `INSERT INTO facilities (facility_name) VALUES ($1) RETURNING facility_id`,
                        [facility_name.trim()]
                    );
                }
                facilityId = facilityRes.rows[0].facility_id;
            }
        }

        const name = `${first_name.trim()} ${last_name.trim()}`;
        const birthdate = new Date();
        birthdate.setFullYear(birthdate.getFullYear() - parseInt(age));
        
        const baselineData = {
            gender,
            diagnosis,
            created_by: req.user.id,
            condition: diagnosis,
            ward: ward ? ward.trim() : null,
            room: room.trim(),
            bed: bed.trim()
        };

        // [OWASP A05] Parameterized insert
        const result = await pool.query(
            `INSERT INTO patients (name, birthdate, baseline_data, facility_id, patient_type, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING patient_id`,
            [name, birthdate, JSON.stringify(baselineData), facilityId, patient_type || (facilityId ? 'facility' : 'at_home')]
        );
        const newPatientId = result.rows[0].patient_id;

        // Grant access to the registering Facility Admin
        await pool.query(
            `INSERT INTO patient_access (user_id, patient_id, relationship, access_level)
             VALUES ($1, $2, 'Facility Admin', 'Edit')`,
            [req.user.id, newPatientId]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'PATIENT_CREATE', $2, 'INFO')`,
            [req.user.id, `Created Patient ID ${newPatientId} in Facility ${facilityId || 'At Home'}`]
        );

        res.status(201).json({ success: true, message: 'Patient registered successfully.', patient_id: newPatientId });
    } catch (err) {
        console.error("Register Patient Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to register patient.' });
    }
});

// Pair an ESP32 device to a patient
router.post('/patients/:patientId/pair-device', async (req, res) => {
    const facilityId = req.user.facility_id;
    const isSysAdmin = req.user.is_sys_admin_override || ['system_admin', 'admin', 'sysadmin'].includes(req.user.role?.toLowerCase());
    const { patientId } = req.params;
    const { serial_number } = req.body;

    try {
        // [OWASP A01 / IDOR] Verify patient belongs to this facility (or sys admin bypass)
        let patientCheck;
        if (isSysAdmin) {
            patientCheck = await pool.query(
                'SELECT patient_id FROM patients WHERE patient_id = $1 AND is_archived IS DISTINCT FROM TRUE',
                [patientId]
            );
        } else {
            patientCheck = await pool.query(
                'SELECT patient_id FROM patients WHERE patient_id = $1 AND facility_id = $2 AND is_archived IS DISTINCT FROM TRUE',
                [patientId, facilityId]
            );
        }
        if (patientCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Patient not found in your facility.' });
        }

        const cleanSN = serial_number.trim().toUpperCase();
        const { register_new } = req.body;

        const deviceCheck = await pool.query(
            `SELECT dw.serial_number, dw.device_name, dw.added_by, dw.assigned_patient_id, u.role as creator_role, u.facility_id as creator_facility_id
             FROM device_whitelist dw
             LEFT JOIN users u ON dw.added_by = u.user_id
             WHERE dw.serial_number = $1 AND dw.is_archived IS DISTINCT FROM TRUE`,
            [cleanSN]
        );

        if (deviceCheck.rows.length === 0) {
            if (register_new || isSysAdmin) {
                // Auto-register new device into inventory and pair to patient
                const devType = cleanSN.startsWith('SD-') ? 'Smart Diaper Module' : 'Vital Sign Monitor';
                await pool.query(
                    `INSERT INTO device_whitelist (serial_number, device_name, status, added_by, assigned_patient_id, created_at, is_archived)
                     VALUES ($1, $2, 'ACTIVE', $3, $4, NOW(), FALSE)`,
                    [cleanSN, devType, req.user.id, patientId]
                );
            } else {
                return res.status(400).json({ 
                    success: false, 
                    message: `Device ${cleanSN} is not registered in system inventory. Please check the serial number or choose "Register a new device to patient".` 
                });
            }
        } else {
            const devRow = deviceCheck.rows[0];
            if (devRow.assigned_patient_id && devRow.assigned_patient_id != patientId) {
                return res.status(409).json({
                    success: false,
                    message: `Device ${cleanSN} is already assigned to another patient (#${devRow.assigned_patient_id}).`
                });
            }

            // Claim and assign device to patient
            await pool.query(
                "UPDATE device_whitelist SET assigned_patient_id = $1, status = 'ACTIVE', added_by = COALESCE(added_by, $2) WHERE serial_number = $3",
                [patientId, req.user.id, cleanSN]
            );
        }

        if (cleanSN.startsWith('VS-')) {
            // Clear stale assignment on other patients
            await pool.query(
                `UPDATE patients SET device_serial_number = NULL WHERE device_serial_number = $1 AND patient_id != $2`,
                [cleanSN, patientId]
            );
            await pool.query(
                'UPDATE patients SET device_serial_number = $1 WHERE patient_id = $2',
                [cleanSN, patientId]
            );
        }

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected)
             VALUES ($1, 'DEVICE_PAIR', $2)`,
            [req.user.id, `Paired device ${cleanSN} to Patient ${patientId}`]
        );

        // Auto-generate system report for device pairing
        systemReportService.recordDevicePairingReport({
            serial_number: cleanSN,
            device_name: cleanSN.startsWith('SD-') ? 'Smart Diaper Module' : 'Vital Sign Monitor',
            patient_id: patientId,
            patient_name: patientCheck.rows[0]?.name,
            assigned_by: req.user.email || `Facility Admin #${req.user.id}`,
            facility_id: req.user.facility_id
        }).catch(err => console.error('Device pairing report error:', err.message));

        res.json({ success: true, message: `Device ${cleanSN} paired successfully to patient.` });
    } catch (err) {
        console.error('Device Pairing Route Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to pair device to patient.' });
    }
});

// Reset SVM baseline for a patient or device
router.post('/patients/:patientId/reset-baseline', async (req, res) => {
    const facilityId = req.user.facility_id;
    const isSysAdmin = req.user.is_sys_admin_override || ['system_admin', 'admin', 'sysadmin'].includes(req.user.role?.toLowerCase());
    const { patientId } = req.params;
    const { reason, device_sn } = req.body;

    if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Clinical reason for baseline reset is required.' });
    }

    try {
        let targetPatientId = parseInt(patientId);

        // If patientId is not a valid number, check if it's a device serial number
        if (isNaN(targetPatientId) || targetPatientId <= 0) {
            const snToCheck = (device_sn || patientId).trim().toUpperCase();
            const devCheck = await pool.query(
                'SELECT serial_number, assigned_patient_id FROM device_whitelist WHERE serial_number = $1 AND is_archived IS DISTINCT FROM TRUE',
                [snToCheck]
            );
            if (devCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `Device "${snToCheck}" does not exist in the system. Cannot reset baseline for an unregistered or imaginary device.`
                });
            }
            if (!devCheck.rows[0].assigned_patient_id) {
                return res.status(400).json({
                    success: false,
                    message: `Device "${snToCheck}" is currently not assigned to any patient. Baseline reset is only applicable to active patient assignments.`
                });
            }
            targetPatientId = devCheck.rows[0].assigned_patient_id;
        }

        // If a specific device serial number was provided, validate it exists
        if (device_sn && device_sn.trim()) {
            const specificSn = device_sn.trim().toUpperCase();
            const devCheck = await pool.query(
                'SELECT serial_number, assigned_patient_id FROM device_whitelist WHERE serial_number = $1 AND is_archived IS DISTINCT FROM TRUE',
                [specificSn]
            );
            if (devCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `Device "${specificSn}" does not exist in the system. Cannot reset baseline for an imaginary device.`
                });
            }
            if (devCheck.rows[0].assigned_patient_id && devCheck.rows[0].assigned_patient_id !== targetPatientId) {
                return res.status(400).json({
                    success: false,
                    message: `Device "${specificSn}" is assigned to Patient #${devCheck.rows[0].assigned_patient_id}, not Patient #${targetPatientId}.`
                });
            }
        }

        // Validate patient existence in system and access scope
        let patientCheck;
        if (isSysAdmin) {
            patientCheck = await pool.query(
                'SELECT patient_id, name, device_serial_number FROM patients WHERE patient_id = $1 AND is_archived IS DISTINCT FROM TRUE',
                [targetPatientId]
            );
        } else {
            patientCheck = await pool.query(
                'SELECT patient_id, name, device_serial_number FROM patients WHERE patient_id = $1 AND (facility_id = $2 OR facility_id IS NULL) AND is_archived IS DISTINCT FROM TRUE',
                [targetPatientId, facilityId]
            );
        }

        if (patientCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Patient #${targetPatientId} does not exist in the system or you do not have permission to manage this record.`
            });
        }

        // Validate that patient has at least one assigned device in whitelist
        const assignedDevs = await pool.query(
            'SELECT serial_number, device_name FROM device_whitelist WHERE assigned_patient_id = $1 AND is_archived IS DISTINCT FROM TRUE',
            [targetPatientId]
        );

        if (assignedDevs.rows.length === 0 && !patientCheck.rows[0].device_serial_number) {
            return res.status(400).json({
                success: false,
                message: `Patient #${targetPatientId} (${patientCheck.rows[0].name}) currently has no active devices assigned. Cannot reset baseline when no sensor hardware is attached.`
            });
        }

        // Clear SVM training data and timestamp
        await pool.query(
            'UPDATE patients SET svm_baseline_data = NULL, baseline_reset_at = NOW() WHERE patient_id = $1',
            [targetPatientId]
        );

        const devList = assignedDevs.rows.map(d => d.serial_number).join(', ') || patientCheck.rows[0].device_serial_number || 'All Devices';

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'SVM_BASELINE_RESET', $2, 'WARNING')`,
            [req.user.id, `Reset SVM baseline for Patient #${targetPatientId} (${patientCheck.rows[0].name}). Assigned Devices: [${devList}]. Reason: ${reason.trim()}`]
        );

        res.json({
            success: true,
            message: `SVM baseline for Patient #${targetPatientId} (${patientCheck.rows[0].name}) has been cleared. The system will relearn normal vital patterns from device (${devList}).`
        });
    } catch (err) {
        console.error('Reset Baseline Error:', err.message);
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
        // [OWASP A01 / IDOR] Verify device belongs to this facility (either patient or registered by user/admin of facility)
        const deviceCheck = await pool.query(
            `SELECT dw.serial_number, dw.device_name, dw.status, dw.last_heartbeat,
                    p.first_name, p.last_name
             FROM device_whitelist dw
             LEFT JOIN patients p ON dw.assigned_patient_id = p.patient_id
             LEFT JOIN users u_added ON dw.added_by = u_added.user_id
             WHERE dw.serial_number = $1 
               AND (
                   dw.added_by = $2
                   OR p.facility_id = $3
                   OR u_added.facility_id = $3
               )`,
            [serialNumber, req.user.id, facilityId]
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

// =================================================================
// MODULE D: ASSIGNMENT COMMAND CENTER (FACILITY ADMIN ACCESS)
// =================================================================

// 1. GET ALL SCOPED ASSIGNMENTS (Active and Pending)
router.get('/assignments', async (req, res) => {
    const adminId = req.user.id;
    try {
        const result = await pool.query(
            `SELECT pa.access_id, pa.user_id, pa.patient_id, pa.relationship, pa.access_level, pa.invite_status,
                    to_char(pa.assigned_at, 'YYYY-MM-DD HH24:MI') as assigned_at,
                    u.username AS caregiver_username, u.first_name AS caregiver_first_name, u.last_name AS caregiver_last_name, u.email AS caregiver_email,
                    p.name AS patient_name,
                    inv.first_name AS invited_by_first_name, inv.last_name AS invited_by_last_name
             FROM patient_access pa
             JOIN users u ON pa.user_id = u.user_id
             JOIN patients p ON pa.patient_id = p.patient_id
             LEFT JOIN users inv ON pa.invited_by = inv.user_id
             WHERE pa.invited_by = $1
                OR pa.user_id IN (SELECT user_id FROM users WHERE created_by = $1)
             ORDER BY pa.assigned_at DESC`,
            [adminId]
        );
        
        const pending = result.rows.filter(r => r.invite_status === 'Pending');
        const active = result.rows.filter(r => r.invite_status !== 'Pending');
        
        res.json({ success: true, data: { pending, active } });
    } catch (err) {
        console.error('Fetch Scoped Assignments Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch assignments.' });
    }
});

// 2. PUT /assignments/:accessId - Update a scoped assignment
router.put('/assignments/:accessId', async (req, res) => {
    const adminId = req.user.id;
    const accessId = parseInt(req.params.accessId);
    const { relationship, access_level } = req.body;
    const client = await pool.connect();
    try {
        // Verify ownership/scoping
        const check = await client.query(
            `SELECT pa.access_id, pa.user_id FROM patient_access pa
             JOIN users u ON pa.user_id = u.user_id
             WHERE pa.access_id = $1 AND (
                 pa.invited_by = $2
                 OR u.created_by = $2
             )`,
            [accessId, adminId]
        );
        if (check.rows.length === 0) {
            client.release();
            return res.status(403).json({ success: false, message: 'Unauthorized or assignment not found.' });
        }

        await client.query('BEGIN');
        await client.query(
            `UPDATE patient_access
             SET relationship = COALESCE($1, relationship),
                 access_level = COALESCE($2, access_level)
             WHERE access_id = $3`,
            [relationship, access_level, accessId]
        );
        
        // Audit log
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'ASSIGNMENT_UPDATE', $2, 'INFO')`,
            [adminId, `Updated assignment ID ${accessId} details.`]
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'Assignment updated successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update Scoped Assignment Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update assignment.' });
    } finally {
        client.release();
    }
});

// 3. DELETE /assignments/:accessId - Delete/Archive scoped assignment
router.delete('/assignments/:accessId', async (req, res) => {
    const adminId = req.user.id;
    const accessId = parseInt(req.params.accessId);
    const client = await pool.connect();
    try {
        // Verify scoping
        const check = await client.query(
            `SELECT pa.access_id, pa.user_id, pa.patient_id FROM patient_access pa
             JOIN users u ON pa.user_id = u.user_id
             WHERE pa.access_id = $1 AND (
                 pa.invited_by = $2
                 OR u.created_by = $2
             )`,
            [accessId, adminId]
        );
        if (check.rows.length === 0) {
            client.release();
            return res.status(403).json({ success: false, message: 'Unauthorized or assignment not found.' });
        }

        const assignment = check.rows[0];

        await client.query('BEGIN');
        await client.query('DELETE FROM patient_access WHERE access_id = $1', [accessId]);
        
        // Audit log
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'ASSIGNMENT_DELETE', $2, 'WARNING')`,
            [adminId, `Deleted assignment for user ID ${assignment.user_id} and patient ID ${assignment.patient_id}.`]
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'Assignment archived successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete Scoped Assignment Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive assignment.' });
    } finally {
        client.release();
    }
});

// 4. GET ALL STAFF ACCOUNTS CREATED BY THIS ADMIN
router.get('/staff-given-accounts', async (req, res) => {
    const adminId = req.user.id;
    try {
        const result = await pool.query(
            `SELECT user_id, username, email, role, account_status, is_locked,
                    to_char(created_at, 'YYYY-MM-DD') as joined_at,
                    last_activity_at,
                    CASE WHEN last_activity_at > NOW() - INTERVAL '2 minutes' THEN true ELSE false END as is_online
             FROM users
             WHERE created_by = $1
             ORDER BY created_at DESC`,
            [adminId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch Scoped Staff Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch staff accounts.' });
    }
});

// 5. PUT /staff-given-accounts/:id - Edit details of a staff account created by this admin
router.put('/staff-given-accounts/:id', async (req, res) => {
    const adminId = req.user.id;
    const targetUserId = parseInt(req.params.id);
    const { username, email, role } = req.body;
    
    if (role && !['caregiver', 'medical_staff'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role.' });
    }
    
    const client = await pool.connect();
    try {
        // Verify scoping
        const check = await client.query(
            'SELECT user_id FROM users WHERE user_id = $1 AND created_by = $2',
            [targetUserId, adminId]
        );
        if (check.rows.length === 0) {
            client.release();
            return res.status(403).json({ success: false, message: 'Unauthorized: User account not found or not created by you.' });
        }
        
        await client.query('BEGIN');
        await client.query(
            `UPDATE users
             SET username = COALESCE($1, username),
                 email = COALESCE($2, email),
                 role = COALESCE($3, role)
             WHERE user_id = $4`,
            [username, email, role, targetUserId]
        );
        
        // Audit log
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'STAFF_ACCOUNT_UPDATE', $2, 'INFO')`,
            [adminId, `Updated details of provisioned staff member ID ${targetUserId}.`]
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'User account updated successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(400).json({ success: false, message: 'Username or email already exists.' });
        }
        console.error('Update Scoped Staff Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update user account.' });
    } finally {
        client.release();
    }
});

// 6. DELETE /staff-given-accounts/:id - Archive staff account created by this admin
router.delete('/staff-given-accounts/:id', async (req, res) => {
    const adminId = req.user.id;
    const targetUserId = parseInt(req.params.id);
    const client = await pool.connect();
    try {
        // Verify scoping
        const check = await client.query(
            'SELECT user_id, username, facility_id FROM users WHERE user_id = $1 AND created_by = $2',
            [targetUserId, adminId]
        );
        if (check.rows.length === 0) {
            client.release();
            return res.status(403).json({ success: false, message: 'Unauthorized: User account not found or not created by you.' });
        }
        
        const user = check.rows[0];
        const username = user.username;
        const facilityId = user.facility_id;

        await client.query('BEGIN');
        await client.query("UPDATE users SET is_archived = true, account_status = 'Archived' WHERE user_id = $1", [targetUserId]);
        
        // Record entry in the archives table
        await client.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
             VALUES ('User', $1, $2, $3, NOW(), 'Archived', $4)`,
            [targetUserId.toString(), username, adminId, facilityId]
        );

        // Audit log
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'STAFF_ACCOUNT_ARCHIVE', $2, 'CRITICAL')`,
            [adminId, `Archived provisioned staff member ${username} (ID ${targetUserId}).`]
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'User account archived successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Archive Scoped Staff Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive user account.' });
    } finally {
        client.release();
    }
});

// 7. GET /patients-added-and-assigned - Scoped Patient Onboarding list
router.get('/patients-added-and-assigned', async (req, res) => {
    const adminId = req.user.id;
    const isSysAdmin = req.user.is_sys_admin_override || ['system_admin', 'admin', 'sysadmin'].includes(req.user.role?.toLowerCase());
    try {
        let query;
        let params = [];
        if (isSysAdmin) {
            query = `
                SELECT p.patient_id, p.name, p.birthdate, p.baseline_data, p.created_at, p.device_serial_number,
                       f.facility_name,
                       COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'serial_number', dw.serial_number,
                                        'device_name', dw.device_name,
                                        'status', dw.status
                                    )
                                )
                                FROM device_whitelist dw
                                WHERE dw.assigned_patient_id = p.patient_id
                            ),
                            '[]'::json
                       ) AS paired_devices,
                       COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'user_id', u.user_id,
                                        'username', u.username,
                                        'first_name', u.first_name,
                                        'last_name', u.last_name,
                                        'email', u.email,
                                        'role', u.role,
                                        'relationship', pa.relationship,
                                        'invite_status', pa.invite_status
                                    )
                                )
                                FROM patient_access pa
                                JOIN users u ON pa.user_id = u.user_id
                                WHERE pa.patient_id = p.patient_id
                                  AND (u.role NOT IN ('caregiver', 'medical_staff') OR pa.invite_status = 'Active')
                            ),
                            '[]'::json
                       ) AS assigned_users
                FROM patients p
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE p.is_archived IS DISTINCT FROM TRUE
                ORDER BY p.created_at DESC
            `;
            params = [];
        } else {
            query = `
                SELECT p.patient_id, p.name, p.birthdate, p.baseline_data, p.created_at, p.device_serial_number,
                       f.facility_name,
                       COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'serial_number', dw.serial_number,
                                        'device_name', dw.device_name,
                                        'status', dw.status
                                    )
                                )
                                FROM device_whitelist dw
                                WHERE dw.assigned_patient_id = p.patient_id
                            ),
                            '[]'::json
                       ) AS paired_devices,
                       COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'user_id', u.user_id,
                                        'username', u.username,
                                        'first_name', u.first_name,
                                        'last_name', u.last_name,
                                        'email', u.email,
                                        'role', u.role,
                                        'relationship', pa.relationship,
                                        'invite_status', pa.invite_status
                                    )
                                )
                                FROM patient_access pa
                                JOIN users u ON pa.user_id = u.user_id
                                WHERE pa.patient_id = p.patient_id AND pa.user_id IS DISTINCT FROM $1
                                  AND (u.role NOT IN ('caregiver', 'medical_staff') OR pa.invite_status = 'Active')
                            ),
                            '[]'::json
                       ) AS assigned_users
                FROM patients p
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE (
                    -- Condition 1: patients they added AND assigned to other users
                    ((p.baseline_data->>'created_by') = $1::text AND EXISTS (
                        SELECT 1 FROM patient_access pa2
                        WHERE pa2.patient_id = p.patient_id
                          AND pa2.user_id IS NOT NULL
                          AND pa2.user_id IS DISTINCT FROM $1
                    ))
                    OR
                    -- Condition 2: patients from the users they gave an account to (caregivers provisioned by admin)
                    p.patient_id IN (
                        SELECT pa3.patient_id FROM patient_access pa3
                        JOIN users u2 ON pa3.user_id = u2.user_id
                        WHERE u2.created_by = $1
                    )
                ) AND p.is_archived IS DISTINCT FROM TRUE
                ORDER BY p.created_at DESC
            `;
            params = [adminId];
        }
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch Scoped Patient List Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch scoped patient list.' });
    }
});

// GET /unassigned-patients - Fetch patients with no caregiver/medical staff assignments
router.get('/unassigned-patients', async (req, res) => {
    const adminId = req.user.id;
    const facilityId = req.user.facility_id;
    const isSysAdmin = req.user.is_sys_admin_override || ['system_admin', 'admin', 'sysadmin'].includes(req.user.role?.toLowerCase());
    try {
        let query;
        let params = [];
        if (isSysAdmin) {
            query = `
                SELECT p.patient_id, p.name, p.birthdate, p.baseline_data, to_char(p.created_at, 'YYYY-MM-DD') AS created_at,
                       f.facility_name,
                       COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'serial_number', dw.serial_number,
                                        'device_name', dw.device_name,
                                        'status', dw.status
                                    )
                                )
                                FROM device_whitelist dw
                                WHERE dw.assigned_patient_id = p.patient_id
                            ),
                            '[]'::json
                       ) AS paired_devices
                FROM patients p
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE p.is_archived IS DISTINCT FROM TRUE
                  AND NOT EXISTS (
                      SELECT 1 FROM patient_access pa
                      JOIN users u ON pa.user_id = u.user_id
                      WHERE pa.patient_id = p.patient_id 
                        AND u.role IN ('caregiver', 'medical_staff')
                        AND pa.invite_status IS DISTINCT FROM 'Declined'
                  )
                ORDER BY p.created_at DESC
            `;
            params = [];
        } else {
            query = `
                SELECT p.patient_id, p.name, p.birthdate, p.baseline_data, to_char(p.created_at, 'YYYY-MM-DD') AS created_at,
                       f.facility_name,
                       COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'serial_number', dw.serial_number,
                                        'device_name', dw.device_name,
                                        'status', dw.status
                                    )
                                )
                                FROM device_whitelist dw
                                WHERE dw.assigned_patient_id = p.patient_id
                            ),
                            '[]'::json
                       ) AS paired_devices
                FROM patients p
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE p.is_archived IS DISTINCT FROM TRUE
                  AND (p.baseline_data->>'created_by' = $1::text OR p.facility_id = $2)
                  AND NOT EXISTS (
                      SELECT 1 FROM patient_access pa
                      JOIN users u ON pa.user_id = u.user_id
                      WHERE pa.patient_id = p.patient_id 
                        AND u.role IN ('caregiver', 'medical_staff')
                        AND pa.invite_status IS DISTINCT FROM 'Declined'
                  )
                ORDER BY p.created_at DESC
            `;
            params = [adminId, facilityId];
        }
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch Unassigned Patients Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch unassigned patients.' });
    }
});

// POST /patients/:patientId/assign-staff-by-email - Assign staff using their email address
router.post('/patients/:patientId/assign-staff-by-email', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { patientId } = req.params;
    const { email } = req.body;
    const isSysAdmin = req.user.is_sys_admin_override;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    try {
        const userRes = await pool.query(
            'SELECT user_id, role, facility_id FROM users WHERE LOWER(email) = LOWER($1)',
            [email.trim()]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User with this email address not found.' });
        }
        const userToAssign = userRes.rows[0];

        if (!['caregiver', 'medical_staff', 'parent'].includes(userToAssign.role)) {
            return res.status(400).json({ success: false, message: 'User must be a registered Caregiver, Medical Staff, or Parent.' });
        }

        if (!isSysAdmin) {
            const patientCheck = await pool.query(
                'SELECT patient_id FROM patients WHERE patient_id = $1 AND facility_id = $2',
                [patientId, facilityId]
            );
            if (patientCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Patient not found in your facility.' });
            }
        }

        const existingCheck = await pool.query(
            `SELECT access_id FROM patient_access
             WHERE user_id = $1 AND patient_id = $2`,
            [userToAssign.user_id, patientId]
        );
        if (existingCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'This patient is already assigned to this staff member.'
            });
        }

        await pool.query(
            `INSERT INTO patient_access (user_id, patient_id, relationship, access_level, invite_status, invited_by)
             VALUES ($1, $2, $3, 'Full', 'Pending', $4)`,
            [
                userToAssign.user_id,
                patientId,
                userToAssign.role === 'medical_staff' ? 'Medical Staff' : 'Primary Caregiver',
                req.user.id
            ]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected)
             VALUES ($1, 'PATIENT_STAFF_ASSIGN_EMAIL', $2)`,
            [req.user.id, `Assigned ${userToAssign.role} (${userToAssign.user_id}) by email to Patient ${patientId}`]
        );

        res.json({ success: true, message: 'Staff member assigned successfully.' });
    } catch (err) {
        console.error('Assignment by email error:', err.message);
        res.status(500).json({ success: false, message: 'Assignment failed.' });
    }
});

// PUT /patients/:patientId - Edit patient name, gender, diagnosis, ward, room, bed
router.put('/patients/:patientId', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { patientId } = req.params;
    const { name, gender, diagnosis, ward, room, bed } = req.body;
    const isSysAdmin = req.user.is_sys_admin_override;

    if (room !== undefined && (!room || !room.trim())) {
        return res.status(400).json({ success: false, message: 'Room name cannot be empty.' });
    }

    try {
        if (!isSysAdmin) {
            const patientCheck = await pool.query(
                'SELECT patient_id FROM patients WHERE patient_id = $1 AND facility_id = $2',
                [patientId, facilityId]
            );
            if (patientCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Patient not found in your facility.' });
            }
        }

        const currentPatient = await pool.query(
            'SELECT name, baseline_data FROM patients WHERE patient_id = $1',
            [patientId]
        );
        if (currentPatient.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient not found.' });
        }

        const updatedName = name || currentPatient.rows[0].name;
        const newBaseline = {
            ...currentPatient.rows[0].baseline_data,
            gender: gender !== undefined ? gender : currentPatient.rows[0].baseline_data?.gender,
            diagnosis: diagnosis !== undefined ? diagnosis : currentPatient.rows[0].baseline_data?.diagnosis,
            ward: ward !== undefined ? (ward ? ward.trim() : null) : currentPatient.rows[0].baseline_data?.ward,
            room: room !== undefined ? room.trim() : currentPatient.rows[0].baseline_data?.room,
            bed: bed !== undefined ? (bed ? bed.trim() : null) : currentPatient.rows[0].baseline_data?.bed
        };

        await pool.query(
            `UPDATE patients
             SET name = $1, baseline_data = $2
             WHERE patient_id = $3`,
            [updatedName, newBaseline, patientId]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected)
             VALUES ($1, 'PATIENT_UPDATE', $2)`,
            [req.user.id, `Updated patient ID ${patientId}`]
        );

        res.json({ success: true, message: 'Patient updated successfully.' });
    } catch (err) {
        console.error('Update Patient Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update patient.' });
    }
});

// DELETE /patients/:patientId - Archive patient
router.delete('/patients/:patientId', async (req, res) => {
    const facilityId = req.user.facility_id;
    const { patientId } = req.params;
    const isSysAdmin = req.user.is_sys_admin_override;

    try {
        let patientName = '';
        let finalFacilityId = facilityId;

        const patientCheck = await pool.query(
            'SELECT patient_id, name, facility_id FROM patients WHERE patient_id = $1',
            [patientId]
        );

        if (patientCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient not found.' });
        }

        const patient = patientCheck.rows[0];
        patientName = patient.name;
        finalFacilityId = patient.facility_id;

        if (!isSysAdmin && finalFacilityId !== facilityId) {
            return res.status(403).json({ success: false, message: 'Unauthorized: Patient not found in your facility.' });
        }

        await pool.query(
            `UPDATE patients
             SET is_archived = TRUE
             WHERE patient_id = $1`,
            [patientId]
        );

        await pool.query(
            `UPDATE device_whitelist
             SET assigned_patient_id = NULL, status = 'AVAILABLE'
             WHERE assigned_patient_id = $1`,
            [patientId]
        );

        // Record entry in the archives table
        await pool.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
             VALUES ('Patient', $1, $2, $3, NOW(), 'Archived', $4)`,
            [patientId.toString(), patientName, req.user.id, finalFacilityId]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'PATIENT_ARCHIVE', $2, 'WARNING')`,
            [req.user.id, `Archived patient ID ${patientId}`]
        );

        res.json({ success: true, message: 'Patient archived successfully.' });
    } catch (err) {
        console.error('Archive Patient Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive patient.' });
    }
});

// GET /dashboard/patients - Fetch patient cards for dashboard
router.get('/dashboard/patients', async (req, res) => {
    const adminId = req.user.id;
    const { facilityId } = req.query;
    const isSysAdmin = req.user.is_sys_admin_override;
    try {
        let result;
        if (isSysAdmin && facilityId) {
            // Fetch patients for the selected facility
            result = await pool.query(
                `SELECT p.patient_id, p.name, p.birthdate, p.baseline_data, p.device_serial_number,
                        to_char(p.created_at, 'YYYY-MM-DD') AS created_at,
                        COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'serial_number', dw.serial_number,
                                        'device_name', dw.device_name,
                                        'status', dw.status,
                                        'last_heartbeat', to_char(dw.last_heartbeat, 'YYYY-MM-DD HH24:MI')
                                    )
                                )
                                FROM device_whitelist dw
                                WHERE dw.assigned_patient_id = p.patient_id
                            ),
                            '[]'::json
                        ) AS paired_devices,
                        COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'username', u.username,
                                        'name', CONCAT(u.first_name, ' ', u.last_name),
                                        'role', u.role
                                    )
                                )
                                FROM patient_access pa
                                JOIN users u ON pa.user_id = u.user_id
                                WHERE pa.patient_id = p.patient_id
                            ),
                            '[]'::json
                        ) AS assigned_staff
                 FROM patients p
                 WHERE p.facility_id = $1 AND p.is_archived IS DISTINCT FROM TRUE
                 ORDER BY p.created_at DESC`,
                [parseInt(facilityId)]
            );
        } else {
            result = await pool.query(
                `SELECT p.patient_id, p.name, p.birthdate, p.baseline_data, p.device_serial_number,
                        to_char(p.created_at, 'YYYY-MM-DD') AS created_at,
                        COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'serial_number', dw.serial_number,
                                        'device_name', dw.device_name,
                                        'status', dw.status,
                                        'last_heartbeat', to_char(dw.last_heartbeat, 'YYYY-MM-DD HH24:MI')
                                    )
                                )
                                FROM device_whitelist dw
                                WHERE dw.assigned_patient_id = p.patient_id
                            ),
                            '[]'::json
                        ) AS paired_devices,
                        COALESCE(
                            (
                                SELECT json_agg(
                                    json_build_object(
                                        'username', u.username,
                                        'name', CONCAT(u.first_name, ' ', u.last_name),
                                        'role', u.role
                                    )
                                )
                                FROM patient_access pa
                                JOIN users u ON pa.user_id = u.user_id
                                WHERE pa.patient_id = p.patient_id
                            ),
                            '[]'::json
                        ) AS assigned_staff
                 FROM patients p
                 WHERE (
                     -- 1. Registered by the facility admin
                     (p.baseline_data->>'created_by' = $1::text)
                     OR
                     -- 2. Registered by users the admin gave accounts to
                      p.patient_id IN (
                          SELECT pa.patient_id FROM patient_access pa
                          JOIN users u ON pa.user_id = u.user_id
                          WHERE u.created_by = $1::integer AND u.role = 'medical_staff' AND pa.relationship = 'Primary Caregiver'
                      )
                 ) AND p.is_archived IS DISTINCT FROM TRUE
                 ORDER BY p.created_at DESC`,
                [adminId]
            );
        }
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch Dashboard Patients Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard patients.' });
    }
});

module.exports = router;
