const router = require('express').Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Ensure token verification on all archive endpoints
router.use(verifyToken);

// GET /api/archives - List archived records
router.get('/', async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const isSysAdmin = req.user.is_sysadmin || ['sysadmin', 'system_admin', 'admin'].includes(userRole);

    try {
        if (isSysAdmin) {
            // Sys admin sees everything
            const query = `
                SELECT 
                    a.archive_id,
                    a.entity_type,
                    a.target_id,
                    a.target_name,
                    a.archived_at,
                    a.status,
                    a.facility_id,
                    f.facility_name,
                    u.username as archived_by_name
                FROM archives a
                LEFT JOIN users u ON a.archived_by = u.user_id
                LEFT JOIN facilities f ON a.facility_id = f.facility_id
                ORDER BY a.archived_at DESC
            `;
            const result = await pool.query(query);
            res.json({ success: true, data: result.rows });
        } else {
            // Facility admin - fetch user's facility ID from DB first
            const userCheck = await pool.query('SELECT facility_id, role FROM users WHERE user_id = $1', [userId]);
            if (userCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'User not found.' });
            }
            const { facility_id, role } = userCheck.rows[0];
            if (role !== 'facility_admin') {
                return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges.' });
            }
            if (!facility_id) {
                return res.status(403).json({ success: false, message: 'Forbidden: No facility assigned to this account.' });
            }

            // Facility admin sees only archives scoped to their facility
            const query = `
                SELECT 
                    a.archive_id,
                    a.entity_type,
                    a.target_id,
                    a.target_name,
                    a.archived_at,
                    a.status,
                    a.facility_id,
                    f.facility_name,
                    u.username as archived_by_name
                FROM archives a
                LEFT JOIN users u ON a.archived_by = u.user_id
                LEFT JOIN facilities f ON a.facility_id = f.facility_id
                WHERE a.facility_id = $1
                ORDER BY a.archived_at DESC
            `;
            const result = await pool.query(query, [facility_id]);
            res.json({ success: true, data: result.rows });
        }
    } catch (err) {
        console.error('Fetch Archives Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch archived records.' });
    }
});

// POST /api/archives/:archiveId/unarchive - Restore an archived record
router.post('/:archiveId/unarchive', async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const isSysAdmin = req.user.is_sysadmin || ['sysadmin', 'system_admin', 'admin'].includes(userRole);
    const archiveId = parseInt(req.params.archiveId, 10);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Fetch archive info
        const archiveCheck = await client.query('SELECT * FROM archives WHERE archive_id = $1', [archiveId]);
        if (archiveCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ success: false, message: 'Archived record not found.' });
        }

        const archive = archiveCheck.rows[0];

        // Enforce facility boundary permissions
        if (!isSysAdmin) {
            const userCheck = await client.query('SELECT facility_id, role FROM users WHERE user_id = $1', [userId]);
            const dbUser = userCheck.rows[0];
            if (dbUser && dbUser.facility_id && archive.facility_id !== dbUser.facility_id) {
                await client.query('ROLLBACK');
                client.release();
                return res.status(403).json({ success: false, message: 'Forbidden: You cannot restore records from another facility.' });
            }
        }

        console.log(`Unarchiving ${archive.entity_type} (ID/Serial: ${archive.target_id})...`);

        // Perform entity specific restore
        switch (archive.entity_type) {
            case 'Patient':
                await client.query('UPDATE patients SET is_archived = FALSE, updated_at = NOW() WHERE patient_id = $1', [parseInt(archive.target_id, 10)]);
                break;
            case 'User':
                await client.query("UPDATE users SET is_archived = FALSE, account_status = 'Verified' WHERE user_id = $1", [parseInt(archive.target_id, 10)]);
                break;
            case 'Device': {
                const originalPatientId = archive.details?.assigned_patient_id;
                if (originalPatientId) {
                    await client.query(
                        "UPDATE device_whitelist SET is_archived = FALSE, status = 'ACTIVE', assigned_patient_id = $1 WHERE serial_number = $2",
                        [originalPatientId, archive.target_id]
                    );
                    await client.query(
                        "UPDATE patients SET device_serial_number = $1 WHERE patient_id = $2",
                        [archive.target_id, originalPatientId]
                    );
                } else {
                    await client.query(
                        "UPDATE device_whitelist SET is_archived = FALSE, status = 'AVAILABLE', assigned_patient_id = NULL WHERE serial_number = $1",
                        [archive.target_id]
                    );
                }
                break;
            }
            case 'Facility':
                await client.query('UPDATE facilities SET is_archived = FALSE WHERE facility_id = $1', [parseInt(archive.target_id, 10)]);
                break;
            case 'Schedule':
                await client.query("UPDATE schedules SET is_archived = FALSE, status = 'Pending' WHERE schedule_id = $1", [parseInt(archive.target_id, 10)]);
                break;
            case 'Announcement':
                await client.query('UPDATE announcements SET is_archived = FALSE, is_active = TRUE WHERE id = $1', [parseInt(archive.target_id, 10)]);
                break;
            case 'Clinical Alert':
                await client.query("UPDATE alert_notifications SET status = 'Active' WHERE alert_id = $1", [parseInt(archive.target_id, 10)]);
                break;
            case 'System Alert':
                await client.query("UPDATE hardware_system_alerts SET status = 'Active' WHERE sys_alert_id = $1", [parseInt(archive.target_id, 10)]);
                break;
            case 'Firmware':
                await client.query("UPDATE system_configs SET is_archived = FALSE WHERE config_key = $1", [archive.target_id]);
                break;
            case 'IP Ban':
                await client.query("UPDATE ip_blacklist SET is_archived = FALSE WHERE id = $1", [parseInt(archive.target_id, 10)]);
                break;
            case 'Assignment':
                await client.query("UPDATE patient_access SET is_archived = FALSE, invite_status = 'Accepted' WHERE access_id = $1", [parseInt(archive.target_id, 10)]);
                break;
            default:
                throw new Error(`Unsupported entity type: ${archive.entity_type}`);
        }

        // Delete from archives
        await client.query('DELETE FROM archives WHERE archive_id = $1', [archiveId]);

        // Log audit trail
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'UNARCHIVE_ENTITY', $2, 'INFO')`,
            [userId, `Unarchived ${archive.entity_type} (ID/Serial: ${archive.target_id}) - ${archive.target_name}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `${archive.entity_type} has been successfully restored.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Restore Archive Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to restore archived record.' });
    } finally {
        client.release();
    }
});

// DELETE /api/archives/:archiveId - Hard delete a record permanently
router.delete('/:archiveId', async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const isSysAdmin = req.user.is_sysadmin || ['sysadmin', 'system_admin', 'admin'].includes(userRole);
    const archiveId = parseInt(req.params.archiveId, 10);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Fetch archive info
        const archiveCheck = await client.query('SELECT * FROM archives WHERE archive_id = $1', [archiveId]);
        if (archiveCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(404).json({ success: false, message: 'Archived record not found.' });
        }

        const archive = archiveCheck.rows[0];

        // Enforce facility boundary permissions
        if (!isSysAdmin) {
            const userCheck = await client.query('SELECT facility_id, role FROM users WHERE user_id = $1', [userId]);
            const dbUser = userCheck.rows[0];
            if (dbUser && dbUser.facility_id && archive.facility_id !== dbUser.facility_id) {
                await client.query('ROLLBACK');
                client.release();
                return res.status(403).json({ success: false, message: 'Forbidden: You cannot permanently delete records from another facility.' });
            }
        }

        console.log(`Hard-deleting ${archive.entity_type} (ID/Serial: ${archive.target_id}) permanently...`);

        // Perform entity specific hard-deletions (cascading constraints if needed)
        switch (archive.entity_type) {
            case 'Patient':
                const patientId = parseInt(archive.target_id, 10);
                await client.query('DELETE FROM patient_access WHERE patient_id = $1', [patientId]);
                await client.query('DELETE FROM sensor_readings WHERE patient_id = $1', [patientId]);
                await client.query('DELETE FROM anomaly_events WHERE patient_id = $1', [patientId]);
                await client.query('DELETE FROM care_logs WHERE patient_id = $1', [patientId]);
                await client.query('DELETE FROM hardware_system_alerts WHERE patient_id = $1', [patientId]);
                await client.query('DELETE FROM reports WHERE patient_id = $1', [patientId]);
                await client.query('DELETE FROM patients WHERE patient_id = $1', [patientId]);
                break;
            case 'User':
                const targetUserId = parseInt(archive.target_id, 10);
                await client.query('DELETE FROM patient_access WHERE user_id = $1', [targetUserId]);
                await client.query('DELETE FROM profiles_caregivers WHERE user_id = $1', [targetUserId]);
                await client.query('DELETE FROM profiles_medical_staff WHERE user_id = $1', [targetUserId]);
                await client.query('DELETE FROM user_permission_overrides WHERE user_id = $1', [targetUserId]);
                await client.query('DELETE FROM user_email_otps WHERE user_id = $1', [targetUserId]);
                await client.query('DELETE FROM session_revocations WHERE user_id = $1', [targetUserId]);
                await client.query('DELETE FROM user_documents WHERE user_id = $1', [targetUserId]);
                await client.query('DELETE FROM users WHERE user_id = $1', [targetUserId]);
                break;
            case 'Device':
                await client.query('DELETE FROM device_whitelist WHERE serial_number = $1', [archive.target_id]);
                break;
            case 'Facility':
                const facilityId = parseInt(archive.target_id, 10);
                await client.query('DELETE FROM facilities WHERE facility_id = $1', [facilityId]);
                break;
            case 'Schedule':
                await client.query('DELETE FROM schedules WHERE schedule_id = $1', [parseInt(archive.target_id, 10)]);
                break;
            case 'Announcement':
                await client.query('DELETE FROM announcements WHERE id = $1', [parseInt(archive.target_id, 10)]);
                break;
            case 'Clinical Alert':
                await client.query('DELETE FROM alert_notifications WHERE alert_id = $1', [parseInt(archive.target_id, 10)]);
                break;
            case 'System Alert':
                await client.query('DELETE FROM hardware_system_alerts WHERE sys_alert_id = $1', [parseInt(archive.target_id, 10)]);
                break;
            default:
                throw new Error(`Unsupported entity type: ${archive.entity_type}`);
        }

        // Delete from archives table
        await client.query('DELETE FROM archives WHERE archive_id = $1', [archiveId]);

        // Log audit trail
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'HARD_DELETE_ENTITY', $2, 'CRITICAL')`,
            [userId, `Hard deleted ${archive.entity_type} (ID/Serial: ${archive.target_id}) - ${archive.target_name} permanently`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `${archive.entity_type} has been permanently deleted.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Hard Delete Archive Error:', err.message);
        res.status(500).json({ success: false, message: `Failed to delete record: ${err.message}` });
    } finally {
        client.release();
    }
});

module.exports = router;
