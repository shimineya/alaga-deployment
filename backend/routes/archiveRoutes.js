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
            // [HIPAA / Data Privacy] De-identify patient names for System Admin: replace with Patient #<ID>
            const sanitizedRows = result.rows.map(row => {
                if (row.entity_type === 'Patient') {
                    return {
                        ...row,
                        target_name: `Patient #${row.target_id}`
                    };
                }
                if (row.entity_type === 'Clinical Alert' && row.target_name) {
                    return {
                        ...row,
                        target_name: row.target_name.replace(/^[^-]+ - (Clinical Alert|Clinical:)/i, `Patient #${row.target_id} - $1`)
                    };
                }
                return row;
            });
            res.json({ success: true, data: sanitizedRows });
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
    if (isNaN(archiveId)) {
        return res.status(400).json({ success: false, message: 'Invalid archive ID.' });
    }

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
                    try {
                        await client.query(
                            "UPDATE patients SET device_serial_number = $1 WHERE patient_id = $2",
                            [archive.target_id, originalPatientId]
                        );
                        await client.query(
                            "UPDATE device_whitelist SET is_archived = FALSE, status = 'ACTIVE', assigned_patient_id = $1 WHERE serial_number = $2",
                            [originalPatientId, archive.target_id]
                        );
                    } catch (assignErr) {
                        await client.query(
                            "UPDATE device_whitelist SET is_archived = FALSE, status = 'AVAILABLE', assigned_patient_id = NULL WHERE serial_number = $1",
                            [archive.target_id]
                        );
                    }
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
                console.warn(`Generic restore for entity type: ${archive.entity_type} (ID: ${archive.target_id})`);
                break;
        }

        // Delete from archives
        await client.query('DELETE FROM archives WHERE archive_id = $1', [archiveId]);

        // Log audit trail (safe savepoint so audit logging issues never abort restore)
        try {
            await client.query('SAVEPOINT audit_sp');
            const uCheck = await client.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
            const validActorId = uCheck.rows.length > 0 ? userId : null;
            await client.query(
                `INSERT INTO access_logs (user_id, action, resource_affected, severity)
                 VALUES ($1, 'UNARCHIVE_ENTITY', $2, 'INFO')`,
                [validActorId, `Unarchived ${archive.entity_type} (ID/Serial: ${archive.target_id}) - ${archive.target_name || ''}`]
            );
            await client.query('RELEASE SAVEPOINT audit_sp');
        } catch (auditErr) {
            await client.query('ROLLBACK TO SAVEPOINT audit_sp');
            console.warn('[ARCHIVE] Audit log write warning during unarchive:', auditErr.message);
        }

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

    if (isNaN(archiveId)) {
        return res.status(400).json({ success: false, message: 'Invalid archive ID.' });
    }

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

        console.log(`Permanently deleting and anonymizing ${archive.entity_type} (ID/Serial: ${archive.target_id})...`);

        // Perform entity-specific anonymization and data preservation (ID is NEVER reused, history retained)
        switch (archive.entity_type) {
            case 'Patient': {
                const patientId = parseInt(archive.target_id, 10);
                if (!isNaN(patientId)) {
                    // Anonymize patient identity: name is NOT NULL in schema, so preserve compliant pseudonym
                    await client.query(
                        `UPDATE patients 
                         SET name = 'De-identified Patient #' || patient_id::text, 
                             device_serial_number = NULL,
                             baseline_data = '{}'::jsonb,
                             svm_baseline_data = '{}'::jsonb,
                             is_archived = TRUE, 
                             deleted_at = NOW()
                         WHERE patient_id = $1`,
                        [patientId]
                    );
                    // Archive patient access links
                    await client.query("UPDATE patient_access SET is_archived = TRUE, invite_status = 'Archived' WHERE patient_id = $1", [patientId]);
                }
                break;
            }
            case 'User': {
                const targetUserId = parseInt(archive.target_id, 10);
                if (!isNaN(targetUserId)) {
                    // Anonymize user identity: email is NOT NULL and UNIQUE, username is UNIQUE
                    await client.query(
                        `UPDATE users 
                         SET first_name = 'Deleted', 
                             last_name = 'User', 
                             username = 'deleted_user_' || user_id::text, 
                             email = 'deleted_user_' || user_id::text || '@anonymized.local', 
                             account_status = 'DELETED', 
                             is_active = FALSE,
                             is_archived = TRUE, 
                             deleted_at = NOW() 
                         WHERE user_id = $1`,
                        [targetUserId]
                    );
                    await client.query('DELETE FROM user_email_otps WHERE user_id = $1', [targetUserId]).catch(() => {});
                    await client.query('DELETE FROM session_revocations WHERE user_id = $1', [targetUserId]).catch(() => {});
                    await client.query("UPDATE patient_access SET is_archived = TRUE, invite_status = 'Archived' WHERE user_id = $1", [targetUserId]).catch(() => {});
                }
                break;
            }
            case 'Device': {
                const serial = archive.target_id;
                // Fetch full device record
                const devRes = await client.query('SELECT * FROM device_whitelist WHERE serial_number = $1', [serial]);
                const dev = devRes.rows[0];
                if (dev) {
                    let telemetryCount = 0;
                    let alertsCount = 0;
                    let patientName = null;

                    try {
                        if (dev.assigned_patient_id) {
                            const [telRes, patRes] = await Promise.all([
                                client.query('SELECT COUNT(*) FROM sensor_readings WHERE patient_id = $1', [dev.assigned_patient_id]),
                                client.query('SELECT name FROM patients WHERE patient_id = $1', [dev.assigned_patient_id])
                            ]);
                            telemetryCount = parseInt(telRes.rows[0]?.count || 0, 10);
                            patientName = patRes.rows[0]?.name || null;
                        }
                        const alertRes = await client.query('SELECT COUNT(*) FROM hardware_system_alerts WHERE device_mac_address = $1', [serial]);
                        alertsCount = parseInt(alertRes.rows[0]?.count || 0, 10);
                    } catch (metricErr) {
                        console.warn('Device metric collection warning:', metricErr.message);
                    }

                    const snapshotData = {
                        device: dev,
                        telemetry_samples: telemetryCount,
                        alerts_recorded: alertsCount,
                        archived_entry: archive,
                        snapshot_timestamp: new Date().toISOString()
                    };

                    // Insert complete snapshot into device_snapshots table if available
                    try {
                        await client.query('SAVEPOINT snap_sp');
                        await client.query(
                            `INSERT INTO device_snapshots (
                                serial_number, device_name,
                                assigned_patient_id, assigned_patient_name,
                                telemetry_count, alerts_count, snapshot_data, deleted_by, created_at
                             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                            [
                                dev.serial_number, dev.device_name || archive.target_name,
                                dev.assigned_patient_id || null, patientName,
                                telemetryCount, alertsCount, JSON.stringify(snapshotData),
                                req.user.email || `User #${userId}`
                            ]
                        );
                        await client.query('RELEASE SAVEPOINT snap_sp');
                    } catch (snapErr) {
                        await client.query('ROLLBACK TO SAVEPOINT snap_sp');
                        console.warn('Device snapshot write warning:', snapErr.message);
                    }

                    // Remove device link from any patient
                    await client.query('UPDATE patients SET device_serial_number = NULL WHERE device_serial_number = $1', [serial]);

                    // Anonymize in device_whitelist: name becomes Decommissioned Device, status DECOMMISSIONED
                    await client.query(
                        "UPDATE device_whitelist SET device_name = 'Decommissioned Device', status = 'DECOMMISSIONED', is_archived = TRUE, assigned_patient_id = NULL, deleted_at = NOW() WHERE serial_number = $1",
                        [serial]
                    );
                }
                break;
            }
            case 'Facility': {
                const facilityId = parseInt(archive.target_id, 10);
                if (!isNaN(facilityId)) {
                    await client.query(
                        "UPDATE facilities SET facility_name = 'Decommissioned Facility #' || facility_id::text, is_archived = TRUE WHERE facility_id = $1",
                        [facilityId]
                    );
                }
                break;
            }
            case 'Schedule': {
                const schedId = parseInt(archive.target_id, 10);
                if (!isNaN(schedId)) {
                    await client.query('DELETE FROM schedules WHERE schedule_id = $1', [schedId]);
                }
                break;
            }
            case 'Announcement': {
                const annId = parseInt(archive.target_id, 10);
                if (!isNaN(annId)) {
                    await client.query('DELETE FROM announcements WHERE id = $1', [annId]);
                }
                break;
            }
            case 'Clinical Alert': {
                const alertId = parseInt(archive.target_id, 10);
                if (!isNaN(alertId)) {
                    await client.query('DELETE FROM alert_notifications WHERE alert_id = $1', [alertId]);
                }
                break;
            }
            case 'System Alert': {
                const sysAlertId = parseInt(archive.target_id, 10);
                if (!isNaN(sysAlertId)) {
                    await client.query('DELETE FROM hardware_system_alerts WHERE sys_alert_id = $1', [sysAlertId]);
                }
                break;
            }
            case 'Firmware':
                await client.query('DELETE FROM system_configs WHERE config_key = $1', [archive.target_id]);
                break;
            case 'IP Ban': {
                const banId = parseInt(archive.target_id, 10);
                if (!isNaN(banId)) {
                    await client.query('DELETE FROM ip_blacklist WHERE id = $1', [banId]);
                }
                break;
            }
            case 'Assignment': {
                const accessId = parseInt(archive.target_id, 10);
                if (!isNaN(accessId)) {
                    await client.query('DELETE FROM patient_access WHERE access_id = $1', [accessId]);
                }
                break;
            }
            default:
                console.warn(`Generic permanent delete for entity type: ${archive.entity_type} (ID: ${archive.target_id})`);
                break;
        }

        // Delete from archives table
        await client.query('DELETE FROM archives WHERE archive_id = $1', [archiveId]);

        // Log audit trail (safe savepoint so audit logging issues never abort delete)
        try {
            await client.query('SAVEPOINT audit_sp');
            const uCheck = await client.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
            const validActorId = uCheck.rows.length > 0 ? userId : null;
            await client.query(
                `INSERT INTO access_logs (user_id, action, resource_affected, severity)
                 VALUES ($1, 'HARD_DELETE_ENTITY', $2, 'CRITICAL')`,
                [validActorId, `Hard deleted ${archive.entity_type} (ID/Serial: ${archive.target_id}) - ${archive.target_name || ''} permanently`]
            );
            await client.query('RELEASE SAVEPOINT audit_sp');
        } catch (auditErr) {
            await client.query('ROLLBACK TO SAVEPOINT audit_sp');
            console.warn('[ARCHIVE] Audit log write warning during delete:', auditErr.message);
        }

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
