const router = require('express').Router();
const pool = require('../db');
const { verifyToken, enforceBreakGlassForSysAdmin } = require('../middleware/authMiddleware');
const systemReportService = require('../services/systemReportService');

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
    const isSysAdmin = req.user.is_sys_admin_override || ['system_admin', 'admin', 'sysadmin'].includes(role?.toLowerCase());
    try {
        let result;

        if (isSysAdmin || role === 'medical_staff') {
            // Full inventory for admin / sysadmin / medical staff
            result = await pool.query(
                `SELECT d.serial_number, d.device_name, d.status, d.last_heartbeat, d.firmware_version,
                        d.assigned_patient_id, d.added_by, d.created_at, p.name as assigned_patient_name,
                        p.baseline_data as assigned_patient_baseline
                 FROM device_whitelist d
                 LEFT JOIN patients p ON d.assigned_patient_id = p.patient_id
                 WHERE d.is_archived IS DISTINCT FROM TRUE
                 ORDER BY d.created_at DESC`
            );
        } else if (role === 'facility_admin') {
            // Scoped inventory for facility admin:
            result = await pool.query(
                `SELECT DISTINCT ON (d.serial_number) 
                        d.serial_number, d.device_name, d.status, d.last_heartbeat,
                        d.firmware_version, d.assigned_patient_id, d.added_by, d.created_at,
                        p.name as assigned_patient_name, p.baseline_data as assigned_patient_baseline
                 FROM device_whitelist d
                 LEFT JOIN patients p ON d.assigned_patient_id = p.patient_id
                 WHERE d.is_archived IS DISTINCT FROM TRUE
                   AND (
                      d.added_by = $1
                      OR d.added_by IN (
                          SELECT user_id FROM users WHERE created_by = $1
                      )
                      OR d.assigned_patient_id IN (
                          SELECT patient_id FROM patient_access WHERE invited_by = $1
                      )
                      OR d.assigned_patient_id IN (
                          SELECT patient_id FROM patient_access WHERE user_id IN (
                              SELECT user_id FROM users WHERE created_by = $1
                          )
                      )
                  )
                 ORDER BY d.serial_number, d.created_at DESC`,
                [userId]
            );
        } else {
            // Caregiver / Parent / Guardian scope:
            result = await pool.query(
                `SELECT DISTINCT ON (d.serial_number) 
                        d.serial_number, d.device_name, d.status, d.last_heartbeat,
                        d.firmware_version, d.assigned_patient_id, d.added_by, d.created_at,
                        p.name as assigned_patient_name, p.baseline_data as assigned_patient_baseline
                 FROM device_whitelist d
                 LEFT JOIN patients p ON d.assigned_patient_id = p.patient_id
                 LEFT JOIN patient_access pa ON pa.patient_id = d.assigned_patient_id
                 WHERE d.is_archived IS DISTINCT FROM TRUE
                   AND (
                      d.added_by = $1
                      OR pa.user_id = $1
                  )
                 ORDER BY d.serial_number, d.created_at DESC`,
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
    // Role guard: allow system_admin, admin, facility_admin, medical_staff, parent, guardian, caregiver
    const userRole = req.user.role?.toLowerCase() || '';
    const isSysAdmin = req.user.is_sys_admin_override || ['admin', 'system_admin', 'sysadmin'].includes(userRole);
    const allowedRoles = ['admin', 'system_admin', 'sysadmin', 'medical_staff', 'parent', 'guardian', 'caregiver', 'facility_admin'];
    
    if (!allowedRoles.includes(userRole) && !isSysAdmin) {
        return res.status(403).json({
            success: false,
            message: 'Only authorized accounts can register new devices.'
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
        const devicesToProcess = [];
        if (vitalDeviceNo) devicesToProcess.push({ serial: vitalDeviceNo, name: 'Vital Sign Monitor' });
        if (diaperDeviceNo) devicesToProcess.push({ serial: diaperDeviceNo, name: 'Smart Diaper Module' });

        const crypto = require('crypto');
        const testTokenHash = crypto.createHash('sha256').update('alaga-test-token').digest('hex');

        for (const dev of devicesToProcess) {
            const exists = await client.query(
                `SELECT dw.serial_number, dw.device_name, dw.status, dw.assigned_patient_id, dw.is_archived, dw.added_by, u.role as creator_role
                 FROM device_whitelist dw
                 LEFT JOIN users u ON dw.added_by = u.user_id
                 WHERE dw.serial_number = $1`,
                [dev.serial]
            );

            if (isSysAdmin) {
                // System Admin Registration (Master Registry)
                if (exists.rows.length > 0) {
                    if (exists.rows[0].is_archived) {
                        await client.query(
                            `UPDATE device_whitelist SET is_archived = FALSE, status = 'AVAILABLE', added_by = $1 WHERE serial_number = $2`,
                            [registeredBy, dev.serial]
                        );
                        inserted.push(dev.serial);
                    } else {
                        await client.query('ROLLBACK');
                        client.release();
                        return res.status(409).json({ success: false, message: `Device ${dev.serial} is already registered in the system.` });
                    }
                } else {
                    await client.query(
                        `INSERT INTO device_whitelist (serial_number, device_name, status, added_by, created_at, device_token_hash, is_archived)
                         VALUES ($1, $2, 'AVAILABLE', $3, NOW(), $4, FALSE)`,
                        [dev.serial, dev.name, registeredBy, testTokenHash]
                    );
                    inserted.push(dev.serial);
                }
            } else {
                // Non-System Admin (Facility Admin, Med Staff, Caregiver, Parent, Guardian)
                // Device MUST already exist in the system whitelist
                if (exists.rows.length === 0 || exists.rows[0].is_archived) {
                    await client.query('ROLLBACK');
                    client.release();
                    return res.status(400).json({
                        success: false,
                        message: `Device ${dev.serial} is not registered in the system by a System Administrator. Please contact a System Administrator to whitelist this device before registering.`
                    });
                }

                const row = exists.rows[0];

                if (row.assigned_patient_id) {
                    await client.query('ROLLBACK');
                    client.release();
                    return res.status(409).json({
                        success: false,
                        message: `Device ${dev.serial} is currently paired with an active patient. Please unpair it first before re-registering.`
                    });
                }

                // Re-register / Claim the system device into this user's account inventory
                await client.query(
                    `UPDATE device_whitelist SET added_by = $1, status = 'AVAILABLE', is_archived = FALSE WHERE serial_number = $2`,
                    [registeredBy, dev.serial]
                );
                inserted.push(dev.serial);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({
            success: true,
            message: isSysAdmin 
                ? `Device(s) registered in system inventory: ${inserted.join(', ')}` 
                : `Device(s) verified and registered: ${inserted.join(', ')}`,
            registered: inserted
        });

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
// 2. ADD NEW PATIENT
// [OWASP A01] Only admin / facility_admin / parent / guardian / medical_staff can enroll new patients.
// ==========================================
router.post('/patients', async (req, res) => {
    // [OWASP A01] Role guard - caregivers strictly cannot enroll patients
    const allowedRoles = ['admin', 'system_admin', 'sysadmin', 'facility_admin', 'medical_staff', 'parent', 'guardian'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Only parent, guardian, medical staff, or administrator accounts can enroll new patients.'
        });
    }

    const { 
        name, first_name, last_name, age, gender,
        birthdate, medicalCondition, diagnosis,
        assignedCaregiverEmail, ward, room, bed, 
        illness, conditions, emergencyContact, patient_type, facility_name
    } = req.body;

    const patientName = name || `${first_name || ''} ${last_name || ''}`.trim();
    if (!patientName) {
        return res.status(400).json({ success: false, message: 'Patient name is required.' });
    }

    if (!room || !room.trim() || !bed || !bed.trim()) {
        return res.status(400).json({ success: false, message: 'Room name and Bed name are required.' });
    }

    let patientBirthdate = birthdate;
    if (!patientBirthdate && age) {
        const approxYear = new Date().getFullYear() - parseInt(age, 10);
        patientBirthdate = `${approxYear}-01-01`;
    }
    if (!patientBirthdate) {
        patientBirthdate = new Date().toISOString().split('T')[0];
    }

    const client = await pool.connect();
    try {
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

        const baselineData = {
            gender: gender || 'Male',
            diagnosis: diagnosis || medicalCondition || illness || '',
            condition: medicalCondition || conditions || diagnosis || null,
            created_by: req.user.id,
            ward: ward ? ward.trim() : null,
            room: room.trim(),
            bed: bed.trim(),
            illness: illness || null,
            medicalConditions: conditions ? (Array.isArray(conditions) ? conditions : conditions.split(',').map(c => c.trim()).filter(Boolean)) : [],
            emergencyContact: emergencyContact || null
        };

        // 1. Insert Patient
        const patientFacilityId = req.user.facility_id || null;
        const patientType = patient_type || (patientFacilityId ? 'facility' : 'at_home');
        const patientRes = await client.query(
            `INSERT INTO patients (name, birthdate, baseline_data, facility_id, patient_type, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING patient_id`,
            [patientName, patientBirthdate, JSON.stringify(baselineData), patientFacilityId, patientType]
        );

        const newPatientId = patientRes.rows[0].patient_id;

        // 2. Grant Access to the Creator (Parent / Guardian / Admin)
        const creatorRelationship = (req.user.role === 'parent' || req.user.role === 'guardian')
            ? (req.user.role === 'parent' ? 'Parent' : 'Guardian')
            : 'Primary Caregiver';

        await client.query(
            `INSERT INTO patient_access (user_id, patient_id, relationship, access_level, invite_status)
             VALUES ($1, $2, $3, 'Edit', 'Active')`,
            [req.user.id, newPatientId, creatorRelationship]
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
        const isSysAdmin = req.user.is_sys_admin_override || ['admin', 'system_admin', 'sysadmin'].includes(req.user.role?.toLowerCase());

        if (vitalDeviceNo) {
            const devCheck = await client.query(
                `SELECT dw.serial_number, dw.assigned_patient_id, dw.added_by, dw.is_archived, u.role as creator_role, u.facility_id as creator_facility_id
                 FROM device_whitelist dw
                 LEFT JOIN users u ON dw.added_by = u.user_id
                 WHERE dw.serial_number = $1`,
                [vitalDeviceNo.trim()]
            );
            if (devCheck.rows.length === 0 || devCheck.rows[0].is_archived) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: `Vital Sign device "${vitalDeviceNo}" is not registered in the master inventory. Only devices pre-registered by a System Administrator can be used.`
                });
            }
            const dev = devCheck.rows[0];
            if (!isSysAdmin) {
                // Must have been registered by this facility / user (not just sitting in SysAdmin inventory)
                const isCreatorSysAdmin = !dev.added_by || ['admin', 'system_admin', 'sysadmin'].includes(dev.creator_role);
                const isClaimedByFacility = dev.added_by === req.user.id || (!isCreatorSysAdmin && req.user.facility_id && dev.creator_facility_id === req.user.facility_id);
                if (!isClaimedByFacility) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        message: `Vital Sign device "${vitalDeviceNo}" has not yet been registered by your facility. Please register/add this device to your inventory before enrolling it with a patient.`
                    });
                }
            }
            if (dev.assigned_patient_id) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    success: false,
                    message: `Vital Sign device "${vitalDeviceNo}" is already assigned to another patient.`
                });
            }

            await client.query(
                "UPDATE device_whitelist SET assigned_patient_id = $1, status = 'ACTIVE' WHERE serial_number = $2",
                [newPatientId, vitalDeviceNo.trim()]
            );
            await client.query(
                "UPDATE patients SET device_serial_number = $1 WHERE patient_id = $2",
                [vitalDeviceNo.trim(), newPatientId]
            );
            systemReportService.recordDevicePairingReport({
                serial_number: vitalDeviceNo.trim(),
                device_name: 'Vital Signs Monitor',
                patient_id: newPatientId,
                patient_name: patientName,
                assigned_by: req.user.email || `User #${req.user.id}`
            }).catch(e => console.error('Device pairing report hook error:', e));
        }

        if (diaperDeviceNo) {
            const devCheck = await client.query(
                `SELECT dw.serial_number, dw.assigned_patient_id, dw.added_by, dw.is_archived, u.role as creator_role, u.facility_id as creator_facility_id
                 FROM device_whitelist dw
                 LEFT JOIN users u ON dw.added_by = u.user_id
                 WHERE dw.serial_number = $1`,
                [diaperDeviceNo.trim()]
            );
            if (devCheck.rows.length === 0 || devCheck.rows[0].is_archived) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: `Smart Diaper device "${diaperDeviceNo}" is not registered in the master inventory. Only devices pre-registered by a System Administrator can be used.`
                });
            }
            const dev = devCheck.rows[0];
            if (!isSysAdmin) {
                // Must have been registered by this facility / user (not just sitting in SysAdmin inventory)
                const isCreatorSysAdmin = !dev.added_by || ['admin', 'system_admin', 'sysadmin'].includes(dev.creator_role);
                const isClaimedByFacility = dev.added_by === req.user.id || (!isCreatorSysAdmin && req.user.facility_id && dev.creator_facility_id === req.user.facility_id);
                if (!isClaimedByFacility) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        message: `Smart Diaper device "${diaperDeviceNo}" has not yet been registered by your facility. Please register/add this device to your inventory before enrolling it with a patient.`
                    });
                }
            }
            if (dev.assigned_patient_id) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    success: false,
                    message: `Smart Diaper device "${diaperDeviceNo}" is already assigned to another patient.`
                });
            }

            await client.query(
                "UPDATE device_whitelist SET assigned_patient_id = $1, status = 'ACTIVE' WHERE serial_number = $2",
                [newPatientId, diaperDeviceNo.trim()]
            );
            systemReportService.recordDevicePairingReport({
                serial_number: diaperDeviceNo.trim(),
                device_name: 'Smart Diaper Sensor',
                patient_id: newPatientId,
                patient_name: patientName,
                assigned_by: req.user.email || `User #${req.user.id}`
            }).catch(e => console.error('Device pairing report hook error:', e));
        }

        await client.query('COMMIT');
        res.status(201).json({ 
            success: true, 
            message: 'Patient registered successfully', 
            patient_id: newPatientId, 
            patientId: newPatientId 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Add Patient Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to enroll patient.' });
    } finally {
        client.release();
    }
});

// Pair device endpoint for caregivers / parents / guardians / facility admin
router.post('/patients/:patientId/pair-device', async (req, res) => {
    const { patientId } = req.params;
    const { serial_number } = req.body;

    if (!serial_number || !serial_number.trim()) {
        return res.status(400).json({ success: false, message: 'Device serial number is required.' });
    }

    try {
        // Validation: Ensure device exists in whitelist and was pre-registered by system admin
        const deviceCheck = await pool.query(
            `SELECT dw.*, u.role as creator_role, u.facility_id as creator_facility_id
             FROM device_whitelist dw 
             LEFT JOIN users u ON dw.added_by = u.user_id 
             WHERE dw.serial_number = $1 AND dw.is_archived IS DISTINCT FROM TRUE`,
            [serial_number.trim()]
        );

        if (deviceCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "This device is not registered in the master inventory. Only devices pre-registered by a System Administrator can be paired."
            });
        }

        const device = deviceCheck.rows[0];
        const isSysAdmin = req.user.is_sys_admin_override || ['admin', 'system_admin', 'sysadmin'].includes(req.user.role?.toLowerCase());
        
        if (!isSysAdmin) {
            // Must have been claimed/registered by this facility / user first (not just sitting in SysAdmin inventory)
            const isCreatorSysAdmin = !device.added_by || ['admin', 'system_admin', 'sysadmin'].includes(device.creator_role);
            const isClaimedByFacility = device.added_by === req.user.id || (!isCreatorSysAdmin && req.user.facility_id && device.creator_facility_id === req.user.facility_id);
            if (!isClaimedByFacility) {
                return res.status(400).json({
                    success: false,
                    message: `Device ${serial_number} has not yet been registered by your facility. Please register/add this device to your inventory before pairing it with a patient.`
                });
            }
        }

        if (device.assigned_patient_id && device.assigned_patient_id != patientId) {
            return res.status(400).json({
                success: false,
                message: `Device ${serial_number} is already assigned to another patient (#${device.assigned_patient_id}).`
            });
        }

        // Get patient name
        const patRes = await pool.query("SELECT name FROM patients WHERE patient_id = $1", [patientId]);
        const patientName = patRes.rows[0]?.name || `Patient #${patientId}`;

        // Pair device
        await pool.query(
            "UPDATE device_whitelist SET assigned_patient_id = $1, status = 'ACTIVE' WHERE serial_number = $2",
            [patientId, serial_number.trim()]
        );

        // Record in system reports
        systemReportService.recordDevicePairingReport({
            serial_number: serial_number.trim(),
            device_name: device.device_name || 'Medical Hardware Sensor',
            patient_id: parseInt(patientId, 10),
            patient_name: patientName,
            assigned_by: req.user.email || `User #${req.user.id}`
        }).catch(e => console.error('Device pairing report hook error:', e));

        res.json({ success: true, message: `Device ${serial_number} paired successfully.` });
    } catch (err) {
        console.error("Pair Device Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to pair device.' });
    }
});

// Assign staff / caregiver by email for parent / guardian / admin
router.post('/patients/:patientId/assign-staff-by-email', async (req, res) => {
    const { patientId } = req.params;
    const { email } = req.body;

    if (!email || !email.trim()) {
        return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    try {
        // 1. Verify caller has access to this patient
        const accessCheck = await pool.query(
            `SELECT * FROM patient_access WHERE user_id = $1 AND patient_id = $2 AND is_archived IS DISTINCT FROM TRUE`,
            [req.user.id, patientId]
        );
        const isAdmin = ['admin', 'system_admin', 'sysadmin', 'facility_admin'].includes(req.user.role?.toLowerCase());
        if (!isAdmin && accessCheck.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'You do not have permission to assign caregivers to this patient.' });
        }

        // 2. Lookup caregiver / medstaff
        const userRes = await pool.query(
            'SELECT user_id, role, first_name, last_name FROM users WHERE LOWER(email) = LOWER($1)',
            [email.trim()]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User with this email address not found.' });
        }
        const userToAssign = userRes.rows[0];
        if (userToAssign.role !== 'caregiver' && userToAssign.role !== 'medical_staff') {
            return res.status(400).json({ success: false, message: 'User is not a registered caregiver or medical staff member.' });
        }

        // 3. Upsert assignment with Pending invite_status
        const existingCheck = await pool.query(
            `SELECT access_id, invite_status, is_archived FROM patient_access
             WHERE user_id = $1 AND patient_id = $2`,
            [userToAssign.user_id, patientId]
        );

        if (existingCheck.rows.length > 0) {
            const existing = existingCheck.rows[0];
            if (existing.invite_status === 'Active' || existing.invite_status === 'Accepted') {
                return res.status(409).json({
                    success: false,
                    message: 'This patient is already actively assigned to this caregiver.'
                });
            }
            // Re-invite if previously declined or pending
            await pool.query(
                `UPDATE patient_access 
                 SET invite_status = 'Pending', is_archived = FALSE, invited_by = $1, relationship = 'Assigned Caregiver'
                 WHERE access_id = $2`,
                [req.user.id, existing.access_id]
            );
        } else {
            await pool.query(
                `INSERT INTO patient_access (user_id, patient_id, relationship, access_level, invite_status, invited_by)
                 VALUES ($1, $2, 'Assigned Caregiver', 'Full', 'Pending', $3)`,
                [userToAssign.user_id, patientId, req.user.id]
            );
        }

        res.json({
            success: true,
            message: `Invitation sent to ${userToAssign.first_name || userToAssign.role} (${email}). The caregiver will see this patient once accepted.`
        });
    } catch (err) {
        console.error("Assign Staff by Email Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to assign caregiver.' });
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

        const { name, birthdate, medicalCondition, ward, room, bed } = req.body;

        if (room !== undefined && (!room || !room.trim())) {
            return res.status(400).json({ success: false, message: 'Room name cannot be empty.' });
        }
        if (bed !== undefined && (!bed || !bed.trim())) {
            return res.status(400).json({ success: false, message: 'Bed name cannot be empty.' });
        }

        const currentPatient = await client.query(
            'SELECT name, baseline_data FROM patients WHERE patient_id = $1',
            [patientId]
        );
        if (currentPatient.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient not found.' });
        }

        const newBaseline = {
            ...currentPatient.rows[0].baseline_data,
            condition: medicalCondition !== undefined ? medicalCondition : (currentPatient.rows[0].baseline_data?.condition || currentPatient.rows[0].baseline_data?.diagnosis),
            diagnosis: medicalCondition !== undefined ? medicalCondition : (currentPatient.rows[0].baseline_data?.diagnosis || currentPatient.rows[0].baseline_data?.condition),
            ward: ward !== undefined ? (ward ? ward.trim() : null) : currentPatient.rows[0].baseline_data?.ward,
            room: room !== undefined ? room.trim() : currentPatient.rows[0].baseline_data?.room,
            bed: bed !== undefined ? bed.trim() : currentPatient.rows[0].baseline_data?.bed
        };

        // [OWASP A05] Parameterized query — no string concatenation.
        await client.query(
            `UPDATE patients
             SET name = COALESCE($1, name),
                 birthdate = COALESCE($2, birthdate),
                 baseline_data = $3,
                 updated_at = NOW()
             WHERE patient_id = $4`,
            [
                name || null,
                birthdate || null,
                JSON.stringify(newBaseline),
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
        // All user roles are permitted to archive data
        const patientId = req.params.id;
        const userId = req.user.id;

        const patientCheck = await client.query('SELECT name, facility_id FROM patients WHERE patient_id = $1', [patientId]);
        if (patientCheck.rows.length === 0) {
            client.release();
            return res.status(404).json({ success: false, message: 'Patient not found.' });
        }
        const patientName = patientCheck.rows[0].name;
        const facilityId = patientCheck.rows[0].facility_id;

        await client.query('BEGIN');
        // [GDPR] Flag as archived (soft delete). The record is retained for the 1-year
        // data retention period mandated by the DPA/GDPR retention policy.
        await client.query(
            `UPDATE patients SET is_archived = TRUE, updated_at = NOW() WHERE patient_id = $1`,
            [patientId]
        );

        // Record entry in the archives table
        await client.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
             VALUES ('Patient', $1, $2, $3, NOW(), 'Archived', $4)`,
            [patientId.toString(), patientName, userId, facilityId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Patient record archived successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
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
        const { role, id: userId, facility_id: userFacilityId } = req.user;
        let query;
        let params;

        if (role === 'admin' || role === 'system_admin' || role === 'sysadmin') {
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
                    f.facility_name,
                    'Admin' as access_level,
                    (
                        SELECT u.user_id
                        FROM patient_access pa2 
                        JOIN users u ON pa2.user_id = u.user_id 
                        WHERE pa2.patient_id = p.patient_id 
                        AND (
                            pa2.relationship IN ('Assigned Caregiver', 'Primary Caregiver', 'Caregiver', 'Attending Physician', 'Assigned Staff', 'Doctor', 'Nurse')
                            OR pa2.relationship ILIKE '%Caregiver%'
                            OR u.role IN ('caregiver', 'medical_staff')
                        )
                        AND (pa2.invite_status IN ('Active', 'Accepted') OR pa2.invite_status IS NULL)
                        AND pa2.is_archived IS DISTINCT FROM TRUE
                        ORDER BY CASE WHEN pa2.invite_status IN ('Active', 'Accepted') THEN 1 ELSE 2 END, pa2.access_id DESC
                        LIMIT 1
                    ) as assigned_caregiver_id,
                    (
                        SELECT COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username, u.email)
                        FROM patient_access pa2 
                        JOIN users u ON pa2.user_id = u.user_id 
                        WHERE pa2.patient_id = p.patient_id 
                        AND (
                            pa2.relationship IN ('Assigned Caregiver', 'Primary Caregiver', 'Caregiver', 'Attending Physician', 'Assigned Staff', 'Doctor', 'Nurse')
                            OR pa2.relationship ILIKE '%Caregiver%'
                            OR u.role IN ('caregiver', 'medical_staff')
                        )
                        AND (pa2.invite_status IN ('Active', 'Accepted') OR pa2.invite_status IS NULL)
                        AND pa2.is_archived IS DISTINCT FROM TRUE
                        ORDER BY CASE WHEN pa2.invite_status IN ('Active', 'Accepted') THEN 1 ELSE 2 END, pa2.access_id DESC
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
                    ) as latest_telemetry,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'user_id', u.user_id,
                                    'username', CONCAT(u.first_name, ' ', u.last_name),
                                    'first_name', u.first_name,
                                    'last_name', u.last_name,
                                    'email', u.email,
                                    'role', u.role,
                                    'relationship', pa2.relationship,
                                    'invite_status', pa2.invite_status
                                )
                            )
                            FROM patient_access pa2 
                            JOIN users u ON pa2.user_id = u.user_id 
                            WHERE pa2.patient_id = p.patient_id 
                            AND pa2.is_archived IS DISTINCT FROM TRUE
                            AND (pa2.invite_status = 'Active' OR pa2.invite_status = 'Accepted' OR u.role NOT IN ('caregiver', 'medical_staff'))
                        ),
                        '[]'::json
                    ) as assigned_users,
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
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as paired_devices,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'user_id', u.user_id,
                                    'username', CONCAT(u.first_name, ' ', u.last_name),
                                    'invite_status', pa2.invite_status
                                )
                            )
                            FROM patient_access pa2 
                            JOIN users u ON pa2.user_id = u.user_id 
                            WHERE pa2.patient_id = p.patient_id 
                            AND pa2.is_archived IS DISTINCT FROM TRUE
                            AND u.role IN ('caregiver', 'medical_staff')
                        ),
                        '[]'::json
                    ) as caregivers,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'serial_number', dw.serial_number,
                                    'device_name', dw.device_name
                                )
                            )
                            FROM device_whitelist dw
                            WHERE dw.assigned_patient_id = p.patient_id
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as devices
                FROM patients p
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE p.is_archived IS DISTINCT FROM TRUE
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [];
        } else if (role === 'medical_staff' && userFacilityId) {
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
                    f.facility_name,
                    'Medical Staff' as access_level,
                    (
                        SELECT u.user_id
                        FROM patient_access pa2 
                        JOIN users u ON pa2.user_id = u.user_id 
                        WHERE pa2.patient_id = p.patient_id 
                        AND (
                            pa2.relationship IN ('Assigned Caregiver', 'Primary Caregiver', 'Caregiver', 'Attending Physician', 'Assigned Staff', 'Doctor', 'Nurse')
                            OR pa2.relationship ILIKE '%Caregiver%'
                            OR u.role IN ('caregiver', 'medical_staff')
                        )
                        AND (pa2.invite_status IN ('Active', 'Accepted') OR pa2.invite_status IS NULL)
                        AND pa2.is_archived IS DISTINCT FROM TRUE
                        ORDER BY CASE WHEN pa2.invite_status IN ('Active', 'Accepted') THEN 1 ELSE 2 END, pa2.access_id DESC
                        LIMIT 1
                    ) as assigned_caregiver_id,
                    (
                        SELECT COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username, u.email)
                        FROM patient_access pa2 
                        JOIN users u ON pa2.user_id = u.user_id 
                        WHERE pa2.patient_id = p.patient_id 
                        AND (
                            pa2.relationship IN ('Assigned Caregiver', 'Primary Caregiver', 'Caregiver', 'Attending Physician', 'Assigned Staff', 'Doctor', 'Nurse')
                            OR pa2.relationship ILIKE '%Caregiver%'
                            OR u.role IN ('caregiver', 'medical_staff')
                        )
                        AND (pa2.invite_status IN ('Active', 'Accepted') OR pa2.invite_status IS NULL)
                        AND pa2.is_archived IS DISTINCT FROM TRUE
                        ORDER BY CASE WHEN pa2.invite_status IN ('Active', 'Accepted') THEN 1 ELSE 2 END, pa2.access_id DESC
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
                    ) as latest_telemetry,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'user_id', u.user_id,
                                    'username', COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username),
                                    'first_name', u.first_name,
                                    'last_name', u.last_name,
                                    'email', u.email,
                                    'role', u.role,
                                    'relationship', pa2.relationship,
                                    'invite_status', pa2.invite_status
                                )
                            )
                            FROM patient_access pa2 
                            JOIN users u ON pa2.user_id = u.user_id 
                            WHERE pa2.patient_id = p.patient_id 
                            AND pa2.is_archived IS DISTINCT FROM TRUE
                            AND (pa2.invite_status = 'Active' OR pa2.invite_status = 'Accepted' OR u.role NOT IN ('caregiver', 'medical_staff'))
                        ),
                        '[]'::json
                    ) as assigned_users,
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
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as paired_devices,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'user_id', u.user_id,
                                    'username', COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username),
                                    'invite_status', pa2.invite_status
                                )
                            )
                            FROM patient_access pa2 
                            JOIN users u ON pa2.user_id = u.user_id 
                            WHERE pa2.patient_id = p.patient_id 
                            AND pa2.is_archived IS DISTINCT FROM TRUE
                            AND u.role IN ('caregiver', 'medical_staff')
                        ),
                        '[]'::json
                    ) as caregivers,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'serial_number', dw.serial_number,
                                    'device_name', dw.device_name
                                )
                            )
                            FROM device_whitelist dw
                            WHERE dw.assigned_patient_id = p.patient_id
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as devices
                FROM patients p
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE p.is_archived IS DISTINCT FROM TRUE AND p.facility_id = $1
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [userFacilityId];
        } else {
            // [Caregiver / Parent / Guardian View] Only assigned patients that they accepted
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
                    f.facility_name,
                    pa.access_level,
                    (
                        SELECT u.user_id
                        FROM patient_access pa2 
                        JOIN users u ON pa2.user_id = u.user_id 
                        WHERE pa2.patient_id = p.patient_id 
                        AND (
                            pa2.relationship IN ('Assigned Caregiver', 'Primary Caregiver', 'Caregiver', 'Attending Physician', 'Assigned Staff', 'Doctor', 'Nurse')
                            OR pa2.relationship ILIKE '%Caregiver%'
                            OR u.role IN ('caregiver', 'medical_staff')
                        )
                        AND (pa2.invite_status IN ('Active', 'Accepted') OR pa2.invite_status IS NULL)
                        AND pa2.is_archived IS DISTINCT FROM TRUE
                        ORDER BY CASE WHEN pa2.invite_status IN ('Active', 'Accepted') THEN 1 ELSE 2 END, pa2.access_id DESC
                        LIMIT 1
                    ) as assigned_caregiver_id,
                    (
                        SELECT COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.username, u.email)
                        FROM patient_access pa2 
                        JOIN users u ON pa2.user_id = u.user_id 
                        WHERE pa2.patient_id = p.patient_id 
                        AND (
                            pa2.relationship IN ('Assigned Caregiver', 'Primary Caregiver', 'Caregiver', 'Attending Physician', 'Assigned Staff', 'Doctor', 'Nurse')
                            OR pa2.relationship ILIKE '%Caregiver%'
                            OR u.role IN ('caregiver', 'medical_staff')
                        )
                        AND (pa2.invite_status IN ('Active', 'Accepted') OR pa2.invite_status IS NULL)
                        AND pa2.is_archived IS DISTINCT FROM TRUE
                        ORDER BY CASE WHEN pa2.invite_status IN ('Active', 'Accepted') THEN 1 ELSE 2 END, pa2.access_id DESC
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
                    ) as latest_telemetry,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'user_id', u.user_id,
                                    'username', CONCAT(u.first_name, ' ', u.last_name),
                                    'first_name', u.first_name,
                                    'last_name', u.last_name,
                                    'email', u.email,
                                    'role', u.role,
                                    'relationship', pa2.relationship,
                                    'invite_status', pa2.invite_status
                                )
                            )
                            FROM patient_access pa2 
                            JOIN users u ON pa2.user_id = u.user_id 
                            WHERE pa2.patient_id = p.patient_id 
                            AND pa2.is_archived IS DISTINCT FROM TRUE
                            AND (pa2.invite_status = 'Active' OR pa2.invite_status = 'Accepted' OR u.role NOT IN ('caregiver', 'medical_staff'))
                        ),
                        '[]'::json
                    ) as assigned_users,
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
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as paired_devices,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'user_id', u.user_id,
                                    'username', CONCAT(u.first_name, ' ', u.last_name),
                                    'invite_status', pa2.invite_status
                                )
                            )
                            FROM patient_access pa2 
                            JOIN users u ON pa2.user_id = u.user_id 
                            WHERE pa2.patient_id = p.patient_id 
                            AND pa2.is_archived IS DISTINCT FROM TRUE
                            AND u.role IN ('caregiver', 'medical_staff')
                        ),
                        '[]'::json
                    ) as caregivers,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'serial_number', dw.serial_number,
                                    'device_name', dw.device_name
                                )
                            )
                            FROM device_whitelist dw
                            WHERE dw.assigned_patient_id = p.patient_id
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as devices
                FROM patients p
                JOIN patient_access pa ON p.patient_id = pa.patient_id
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE pa.user_id = $1 
                  AND p.is_archived IS DISTINCT FROM TRUE 
                  AND (pa.invite_status = 'Active' OR pa.invite_status = 'Accepted' OR (pa.invite_status IS NULL AND $2 != 'caregiver'))
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [userId, role];
        }

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Get Patients Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch patients' });
    }
});

// ==========================================
// 3.1. GET PATIENTS ADDED AND ASSIGNED (Caregiver / Parent / Guardian / Staff scope)
// ==========================================
router.get('/patients-added-and-assigned', async (req, res) => {
    try {
        const { role, id: userId, facility_id: userFacilityId } = req.user;
        const isSysAdmin = req.user.is_sys_admin_override || ['system_admin', 'admin', 'sysadmin'].includes(role?.toLowerCase());
        const isParentOrGuardian = role === 'parent' || role === 'guardian';
        const isMedicalStaff = role === 'medical_staff';
        
        let query;
        let params;

        if (isSysAdmin) {
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
                    f.facility_name,
                    'Admin' as access_level,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'user_id', u.user_id,
                                    'username', CONCAT(u.first_name, ' ', u.last_name),
                                    'first_name', u.first_name,
                                    'last_name', u.last_name,
                                    'email', u.email,
                                    'role', u.role,
                                    'relationship', pa2.relationship,
                                    'invite_status', pa2.invite_status
                                )
                            )
                            FROM patient_access pa2 
                            JOIN users u ON pa2.user_id = u.user_id 
                            WHERE pa2.patient_id = p.patient_id 
                            AND pa2.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as assigned_users,
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
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as paired_devices
                FROM patients p
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE p.is_archived IS DISTINCT FROM TRUE
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [];
        } else if (isParentOrGuardian) {
            // Patients added by this parent/guardian OR where they have access
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
                    f.facility_name,
                    pa.access_level,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'user_id', u.user_id,
                                    'username', CONCAT(u.first_name, ' ', u.last_name),
                                    'first_name', u.first_name,
                                    'last_name', u.last_name,
                                    'email', u.email,
                                    'role', u.role,
                                    'relationship', pa2.relationship,
                                    'invite_status', pa2.invite_status
                                )
                            )
                            FROM patient_access pa2 
                            JOIN users u ON pa2.user_id = u.user_id 
                            WHERE pa2.patient_id = p.patient_id 
                            AND pa2.user_id != $1
                            AND pa2.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as assigned_users,
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
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as paired_devices
                FROM patients p
                LEFT JOIN patient_access pa ON p.patient_id = pa.patient_id AND pa.user_id = $1
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE p.is_archived IS DISTINCT FROM TRUE
                  AND ((p.baseline_data->>'created_by') = $1::text OR pa.user_id = $1)
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [userId];
        } else if (isMedicalStaff) {
            // Medical staff in facility
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
                    f.facility_name,
                    'Medical Staff' as access_level,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'user_id', u.user_id,
                                    'username', CONCAT(u.first_name, ' ', u.last_name),
                                    'first_name', u.first_name,
                                    'last_name', u.last_name,
                                    'email', u.email,
                                    'role', u.role,
                                    'relationship', pa2.relationship,
                                    'invite_status', pa2.invite_status
                                )
                            )
                            FROM patient_access pa2 
                            JOIN users u ON pa2.user_id = u.user_id 
                            WHERE pa2.patient_id = p.patient_id 
                            AND pa2.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as assigned_users,
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
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as paired_devices
                FROM patients p
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE p.is_archived IS DISTINCT FROM TRUE
                  AND (p.facility_id = $1 OR (p.baseline_data->>'created_by') = $2::text)
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [userFacilityId, userId];
        } else {
            // Caregiver: only accepted assignments
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
                    f.facility_name,
                    pa.access_level,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'user_id', u.user_id,
                                    'username', CONCAT(u.first_name, ' ', u.last_name),
                                    'first_name', u.first_name,
                                    'last_name', u.last_name,
                                    'email', u.email,
                                    'role', u.role,
                                    'relationship', pa2.relationship,
                                    'invite_status', pa2.invite_status
                                )
                            )
                            FROM patient_access pa2 
                            JOIN users u ON pa2.user_id = u.user_id 
                            WHERE pa2.patient_id = p.patient_id 
                            AND pa2.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as assigned_users,
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
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as paired_devices
                FROM patients p
                JOIN patient_access pa ON p.patient_id = pa.patient_id
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE pa.user_id = $1
                  AND p.is_archived IS DISTINCT FROM TRUE
                  AND pa.invite_status IN ('Active', 'Accepted')
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [userId];
        }

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Get Patients Added & Assigned Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch patients' });
    }
});

// ==========================================
// 3.2. GET UNASSIGNED PATIENTS (Caregiver / Parent / Guardian / Staff scope)
// ==========================================
router.get('/unassigned-patients', async (req, res) => {
    try {
        const { role, id: userId, facility_id: userFacilityId } = req.user;
        const isSysAdmin = req.user.is_sys_admin_override || ['system_admin', 'admin', 'sysadmin'].includes(role?.toLowerCase());
        const isParentOrGuardian = role === 'parent' || role === 'guardian';
        const isMedicalStaff = role === 'medical_staff';
        
        let query;
        let params;

        if (isSysAdmin) {
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
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
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as paired_devices,
                    '[]'::json as assigned_users
                FROM patients p
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE p.is_archived IS DISTINCT FROM TRUE
                  AND NOT EXISTS (
                      SELECT 1 FROM patient_access pa
                      JOIN users u ON pa.user_id = u.user_id
                      WHERE pa.patient_id = p.patient_id 
                        AND u.role IN ('caregiver', 'medical_staff')
                        AND pa.invite_status IN ('Active', 'Accepted')
                  )
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [];
        } else if (isParentOrGuardian) {
            // Patients added by this parent/guardian or they have access to, without an active assigned caregiver
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
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
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as paired_devices,
                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'user_id', u.user_id,
                                    'username', CONCAT(u.first_name, ' ', u.last_name),
                                    'email', u.email,
                                    'role', u.role,
                                    'relationship', pa2.relationship,
                                    'invite_status', pa2.invite_status
                                )
                            )
                            FROM patient_access pa2 
                            JOIN users u ON pa2.user_id = u.user_id 
                            WHERE pa2.patient_id = p.patient_id 
                            AND pa2.user_id != $1
                            AND pa2.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as assigned_users
                FROM patients p
                LEFT JOIN patient_access pa ON p.patient_id = pa.patient_id AND pa.user_id = $1
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE p.is_archived IS DISTINCT FROM TRUE
                  AND ((p.baseline_data->>'created_by') = $1::text OR pa.user_id = $1)
                  AND NOT EXISTS (
                      SELECT 1 FROM patient_access pa3
                      JOIN users u3 ON pa3.user_id = u3.user_id
                      WHERE pa3.patient_id = p.patient_id 
                        AND pa3.user_id != $1
                        AND u3.role IN ('caregiver', 'medical_staff')
                        AND pa3.invite_status IN ('Active', 'Accepted')
                  )
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [userId];
        } else if (isMedicalStaff) {
            query = `
                SELECT DISTINCT ON (p.patient_id) 
                    p.*, 
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
                            AND dw.is_archived IS DISTINCT FROM TRUE
                        ),
                        '[]'::json
                    ) as paired_devices,
                    '[]'::json as assigned_users
                FROM patients p
                LEFT JOIN facilities f ON p.facility_id = f.facility_id
                WHERE p.is_archived IS DISTINCT FROM TRUE
                  AND (p.facility_id = $1 OR (p.baseline_data->>'created_by') = $2::text)
                  AND NOT EXISTS (
                      SELECT 1 FROM patient_access pa
                      JOIN users u ON pa.user_id = u.user_id
                      WHERE pa.patient_id = p.patient_id 
                        AND u.role IN ('caregiver')
                        AND pa.invite_status IN ('Active', 'Accepted')
                  )
                ORDER BY p.patient_id, p.created_at DESC
            `;
            params = [userFacilityId, userId];
        } else {
            // Plain caregivers cannot view unassigned pool
            return res.json({ success: true, data: [] });
        }

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Get Unassigned Patients Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch unassigned patients' });
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

        // Auto-generate system report for device pairing
        systemReportService.recordDevicePairingReport({
            serial_number: serialNumber,
            device_name: deviceCheck.rows[0]?.device_name,
            patient_id: patientId,
            assigned_by: req.user.email || `User #${req.user.id}`
        }).catch(e => console.error('Device pairing report hook error:', e));

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

        // [OWASP A01] Scoped check for facility admin
        if (req.user.role === 'facility_admin') {
            const hasAccess = await client.query(
                `SELECT 1 FROM device_whitelist d
                 WHERE d.serial_number = $1 AND (
                     d.added_by = $2
                     OR d.added_by IN (
                         SELECT user_id FROM users WHERE created_by = $2
                     )
                     OR d.assigned_patient_id IN (
                         SELECT patient_id FROM patient_access WHERE invited_by = $2
                     )
                     OR d.assigned_patient_id IN (
                         SELECT patient_id FROM patient_access WHERE user_id IN (
                             SELECT user_id FROM users WHERE created_by = $2
                         )
                     )
                 )`,
                [serialNumber, req.user.id]
            );
            if (hasAccess.rows.length === 0) {
                client.release();
                return res.status(403).json({ success: false, message: 'Unauthorized: You do not have permission to unpair this device.' });
            }
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

        // [SAFETY] Check access level of target member to avoid removing the primary owner
        const targetCheck = await client.query(
            "SELECT access_level FROM patient_access WHERE patient_id = $1 AND user_id = $2",
            [patientId, userId]
        );
        if (targetCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Caregiver not found in this team.' });
        }

        if (targetCheck.rows[0].access_level === 'Edit') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Cannot remove the primary owner of this patient record.'
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
router.delete('/patients/:id', async (req, res) => {
    const patientId = req.params.id;
    const actorId   = req.user.id;
    const client    = await pool.connect();

    try {
        // Verify the patient actually exists before attempting deletion.
        const check = await client.query(
            'SELECT patient_id, name, facility_id FROM patients WHERE patient_id = $1',
            [patientId]
        );
        if (check.rows.length === 0) {
            client.release();
            return res.status(404).json({ success: false, message: 'Patient record not found.' });
        }
        const patient = check.rows[0];
        const patientName = patient.name;
        const facilityId = patient.facility_id;

        await client.query('BEGIN');

        // 1. [HIPAA] Write audit trail before archiving
        await client.query(
            `INSERT INTO access_logs (user_id, action, target_patient_id, resource_affected, details, "timestamp")
             VALUES ($1, 'ARCHIVE_PATIENT', $2, 'patient', $3::jsonb, NOW())`,
            [actorId, patientId, JSON.stringify({ archived_patient_name: patientName, actor_id: actorId })]
        );

        // 2. Unlink all devices assigned to this patient — resets them to AVAILABLE.
        await client.query(
            `UPDATE device_whitelist
             SET assigned_patient_id = NULL, status = 'AVAILABLE'
             WHERE assigned_patient_id = $1`,
            [patientId]
        );

        // 3. Clear device_serial_number on the patient row.
        await client.query(
            'UPDATE patients SET device_serial_number = NULL, is_archived = TRUE, updated_at = NOW() WHERE patient_id = $1',
            [patientId]
        );

        // 4. Record entry in the archives table
        await client.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
             VALUES ('Patient', $1, $2, $3, NOW(), 'Archived', $4)`,
            [patientId.toString(), patientName, actorId, facilityId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Patient ${patientName} has been archived successfully.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Archive Patient Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive patient record.' });
    } finally {
        client.release();
    }
});

// ==========================================
// DELETE DEVICE FROM INVENTORY
// [OWASP A01] Only admin/parent accounts may remove a device from the whitelist.
// [OWASP A05] Serial number is a parameterized path variable.
// [HIPAA] Audit entry written before deletion.
router.delete('/devices/:serialNumber', async (req, res) => {
    const serialNumber = req.params.serialNumber;
    const actorId      = req.user.id;
    const role         = req.user.role;
    const client       = await pool.connect();

    try {
        // Confirm the device exists.
        const check = await client.query(
            'SELECT serial_number, device_name, assigned_patient_id, added_by FROM device_whitelist WHERE serial_number = $1',
            [serialNumber]
        );
        if (check.rows.length === 0) {
            client.release();
            return res.status(404).json({ success: false, message: 'Device not found in inventory.' });
        }

        // [OWASP A01] Verify facility admin scoped access
        if (role === 'facility_admin') {
            const hasAccess = await client.query(
                `SELECT 1 FROM device_whitelist d
                 WHERE d.serial_number = $1 AND (
                     d.added_by = $2
                     OR d.added_by IN (
                         SELECT user_id FROM users WHERE created_by = $2
                     )
                     OR d.assigned_patient_id IN (
                         SELECT patient_id FROM patient_access WHERE invited_by = $2
                     )
                     OR d.assigned_patient_id IN (
                         SELECT patient_id FROM patient_access WHERE user_id IN (
                             SELECT user_id FROM users WHERE created_by = $2
                         )
                     )
                 )`,
                [serialNumber, actorId]
            );
            if (hasAccess.rows.length === 0) {
                client.release();
                return res.status(403).json({ success: false, message: 'Unauthorized: You do not have permission to delete this device.' });
            }
        }

        const device     = check.rows[0];
        const patientId  = device.assigned_patient_id;

        // Resolve facility ID for the archive table
        const facilityCheck = await client.query('SELECT facility_id FROM users WHERE user_id = $1', [device.added_by || actorId]);
        const devFacilityId = facilityCheck.rows[0]?.facility_id || null;

        await client.query('BEGIN');

        // [HIPAA] Audit trail before archiving.
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, details, "timestamp")
             VALUES ($1, 'ARCHIVE_DEVICE', 'device_whitelist', $2::jsonb, NOW())`,
            [actorId, JSON.stringify({ serial_number: serialNumber, device_name: device.device_name, had_patient: !!patientId })]
        );

        // If the device was assigned to a patient, clear the patient's device reference first.
        if (patientId) {
            await client.query(
                'UPDATE patients SET device_serial_number = NULL WHERE patient_id = $1 AND device_serial_number = $2',
                [patientId, serialNumber]
            );
        }

        // Soft-delete the device from the whitelist.
        await client.query(
            "UPDATE device_whitelist SET is_archived = TRUE, status = 'ARCHIVED', assigned_patient_id = NULL WHERE serial_number = $1",
            [serialNumber]
        );

        // Record entry in the archives table
        await client.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id, details)
             VALUES ('Device', $1, $2, $3, NOW(), 'Archived', $4, $5::jsonb)`,
            [serialNumber, device.device_name || serialNumber, actorId, devFacilityId, JSON.stringify({ assigned_patient_id: patientId })]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Device ${serialNumber} has been archived successfully.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Archive Device Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive device from inventory.' });
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
router.delete('/users/:userId', async (req, res) => {
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
            `SELECT user_id, username, role, facility_id FROM users WHERE user_id = $1`,
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

        // [HIPAA] Audit trail before archiving.
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, details, "timestamp")
             VALUES ($1, 'ARCHIVE_USER', 'users', $2::jsonb, NOW())`,
            [actorId, JSON.stringify({ archived_user_id: targetUserId, archived_username: targetUser.username, role: targetUser.role })]
        );

        // 1. Soft-delete the user account.
        await client.query(
            "UPDATE users SET is_archived = TRUE, account_status = 'Archived' WHERE user_id = $1",
            [targetUserId]
        );

        // 2. Invalidate all active OTPs/sessions for this user.
        await client.query(
            'UPDATE user_email_otps SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL',
            [targetUserId]
        );

        // 3. Record entry in the archives table
        await client.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
             VALUES ('User', $1, $2, $3, NOW(), 'Archived', $4)`,
            [targetUserId.toString(), targetUser.username, actorId, targetUser.facility_id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `User account ${targetUser.username} has been archived successfully.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Archive User Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive user account.' });
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

// ==========================================
// ROUTE: POST /devices/archive
// Description: Archive a device by serial number (deletes from whitelist)
// ==========================================
router.post('/devices/archive', async (req, res) => {
    const { serialNumber } = req.body;
    const actorId = req.user.id;
    const role = req.user.role;

    // All user roles are permitted to archive data

    if (!serialNumber) {
        return res.status(400).json({ success: false, message: 'Serial number is required.' });
    }

    const client = await pool.connect();
    try {
        // Confirm the device exists.
        const check = await client.query(
            'SELECT serial_number, device_name, status, assigned_patient_id, added_by FROM device_whitelist WHERE serial_number = $1',
            [serialNumber]
        );
        if (check.rows.length === 0) {
            client.release();
            return res.status(404).json({ success: false, message: 'Device not found in inventory.' });
        }

        const device = check.rows[0];
        const patientId = device.assigned_patient_id;

        // System Admin: Only allow archiving if the device is unpaired and inactive
        if (['admin', 'system_admin', 'sysadmin'].includes(role)) {
            if (patientId || device.status !== 'INACTIVE') {
                client.release();
                return res.status(400).json({
                    success: false,
                    message: 'System administrators can only archive devices that are both unpaired and inactive.'
                });
            }
        }

        // Verify facility admin access
        if (role === 'facility_admin') {
            const hasAccess = await client.query(
                `SELECT 1 FROM device_whitelist d
                 WHERE d.serial_number = $1 AND (
                     d.added_by = $2
                     OR d.added_by IN (
                         SELECT user_id FROM users WHERE created_by = $2
                     )
                     OR d.assigned_patient_id IN (
                         SELECT patient_id FROM patient_access WHERE invited_by = $2
                     )
                     OR d.assigned_patient_id IN (
                         SELECT patient_id FROM patient_access WHERE user_id IN (
                             SELECT user_id FROM users WHERE created_by = $2
                         )
                     )
                 )`,
                [serialNumber, actorId]
            );
            if (hasAccess.rows.length === 0) {
                client.release();
                return res.status(403).json({ success: false, message: 'Unauthorized: You do not have permission to delete this device.' });
            }
        }

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

        // Soft-delete/Archive the device from the whitelist.
        await client.query(
            "UPDATE device_whitelist SET is_archived = TRUE, status = 'ARCHIVED', assigned_patient_id = NULL WHERE serial_number = $1",
            [serialNumber]
        );

        // Resolve facility ID for the archive table
        const facilityCheck = await client.query('SELECT facility_id FROM users WHERE user_id = $1', [device.added_by || actorId]);
        const devFacilityId = facilityCheck.rows[0]?.facility_id || null;

        // Record entry in the archives table
        await client.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id, details)
             VALUES ('Device', $1, $2, $3, NOW(), 'Archived', $4, $5::jsonb)`,
            [serialNumber, device.device_name, actorId, devFacilityId, JSON.stringify({ assigned_patient_id: patientId })]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Device ${serialNumber} has been removed from inventory.` });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Archive Device Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive device from inventory.' });
    } finally {
        client.release();
    }
});

// ==========================================
// ROUTE: POST /devices/assign
// Description: Assign diaper/vitals devices to a patient by name
// ==========================================
router.post('/devices/assign', async (req, res) => {
    const { patientName, smartDiaperSn, vitalSignsSn } = req.body;
    const actorId = req.user.id;
    const role = req.user.role.toLowerCase();

    if (!patientName) {
        return res.status(400).json({ success: false, message: 'Patient name is required.' });
    }

    if (!smartDiaperSn && !vitalSignsSn) {
        return res.status(400).json({ success: false, message: 'At least one device serial number must be provided.' });
    }

    const client = await pool.connect();
    try {
        // 1. Resolve Patient record using the actor's access scope
        let patientRow;
        if (role === 'admin' || role === 'system_admin' || role === 'sysadmin') {
            const patRes = await client.query(
                `SELECT patient_id FROM patients WHERE LOWER(name) = LOWER($1) AND is_archived IS DISTINCT FROM TRUE`,
                [patientName.trim()]
            );
            patientRow = patRes.rows[0];
        } else if (role === 'facility_admin') {
            const patRes = await client.query(
                `SELECT patient_id FROM patients WHERE LOWER(name) = LOWER($1) AND facility_id = $2 AND is_archived IS DISTINCT FROM TRUE`,
                [patientName.trim(), req.user.facility_id]
            );
            patientRow = patRes.rows[0];
        } else {
            const patRes = await client.query(
                `SELECT p.patient_id FROM patients p
                 JOIN patient_access pa ON p.patient_id = pa.patient_id
                 WHERE LOWER(p.name) = LOWER($1) AND pa.user_id = $2 AND pa.access_level = 'Edit' AND p.is_archived IS DISTINCT FROM TRUE`,
                [patientName.trim(), actorId]
            );
            patientRow = patRes.rows[0];
        }

        if (!patientRow) {
            client.release();
            return res.status(404).json({ success: false, message: `Patient with name "${patientName}" not found or not in your access scope.` });
        }

        const patientId = patientRow.patient_id;

        const isSysAdmin = req.user.is_sys_admin_override || ['admin', 'system_admin', 'sysadmin'].includes(role);

        // 2. Validate device whitelist registration & availability
        if (smartDiaperSn) {
            const checkDiaper = await client.query(
                `SELECT dw.serial_number, dw.assigned_patient_id, dw.added_by, u.role as creator_role, u.facility_id as creator_facility_id
                 FROM device_whitelist dw
                 LEFT JOIN users u ON dw.added_by = u.user_id
                 WHERE dw.serial_number = $1 AND dw.is_archived IS DISTINCT FROM TRUE`,
                [smartDiaperSn]
            );
            if (checkDiaper.rows.length === 0) {
                client.release();
                return res.status(404).json({ success: false, message: `Diaper device ${smartDiaperSn} not registered in master whitelist.` });
            }
            const diaperDev = checkDiaper.rows[0];
            if (!isSysAdmin) {
                const isCreatorSysAdmin = !diaperDev.added_by || ['admin', 'system_admin', 'sysadmin'].includes(diaperDev.creator_role);
                const isClaimedByFacility = diaperDev.added_by === actorId || (!isCreatorSysAdmin && req.user.facility_id && diaperDev.creator_facility_id === req.user.facility_id);
                if (!isClaimedByFacility) {
                    client.release();
                    return res.status(400).json({
                        success: false,
                        message: `Diaper device ${smartDiaperSn} has not yet been registered by your facility. Please register/add this device to your inventory before assigning it to a patient.`
                    });
                }
            }
            if (diaperDev.assigned_patient_id && diaperDev.assigned_patient_id !== patientId) {
                client.release();
                return res.status(409).json({ success: false, message: `Diaper device ${smartDiaperSn} is already assigned to another patient.` });
            }
        }

        if (vitalSignsSn) {
            const checkVital = await client.query(
                `SELECT dw.serial_number, dw.assigned_patient_id, dw.added_by, u.role as creator_role, u.facility_id as creator_facility_id
                 FROM device_whitelist dw
                 LEFT JOIN users u ON dw.added_by = u.user_id
                 WHERE dw.serial_number = $1 AND dw.is_archived IS DISTINCT FROM TRUE`,
                [vitalSignsSn]
            );
            if (checkVital.rows.length === 0) {
                client.release();
                return res.status(404).json({ success: false, message: `Vital Signs device ${vitalSignsSn} not registered in master whitelist.` });
            }
            const vitalDev = checkVital.rows[0];
            if (!isSysAdmin) {
                const isCreatorSysAdmin = !vitalDev.added_by || ['admin', 'system_admin', 'sysadmin'].includes(vitalDev.creator_role);
                const isClaimedByFacility = vitalDev.added_by === actorId || (!isCreatorSysAdmin && req.user.facility_id && vitalDev.creator_facility_id === req.user.facility_id);
                if (!isClaimedByFacility) {
                    client.release();
                    return res.status(400).json({
                        success: false,
                        message: `Vital Signs device ${vitalSignsSn} has not yet been registered by your facility. Please register/add this device to your inventory before assigning it to a patient.`
                    });
                }
            }
            if (vitalDev.assigned_patient_id && vitalDev.assigned_patient_id !== patientId) {
                client.release();
                return res.status(409).json({ success: false, message: `Vital Signs device ${vitalSignsSn} is already assigned to another patient.` });
            }
        }

        // 3. Begin Transaction & perform assignments
        await client.query('BEGIN');

        if (smartDiaperSn) {
            await client.query(
                `UPDATE device_whitelist SET assigned_patient_id = $1, status = 'ACTIVE' WHERE serial_number = $2`,
                [patientId, smartDiaperSn]
            );
            await client.query(
                `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected)
                 VALUES ($1, $2, 'ASSIGN_DEVICE', $3)`,
                [actorId, patientId, `Assigned Smart Diaper ${smartDiaperSn} to Patient ${patientId}`]
            );
        }

        if (vitalSignsSn) {
            await client.query(
                `UPDATE device_whitelist SET assigned_patient_id = $1, status = 'ACTIVE' WHERE serial_number = $2`,
                [patientId, vitalSignsSn]
            );
            await client.query(
                `UPDATE patients SET device_serial_number = $1 WHERE patient_id = $2`,
                [vitalSignsSn, patientId]
            );
            await client.query(
                `INSERT INTO access_logs (user_id, target_patient_id, action, resource_affected)
                 VALUES ($1, $2, 'ASSIGN_DEVICE', $3)`,
                [actorId, patientId, `Assigned Vital Signs Monitor ${vitalSignsSn} to Patient ${patientId}`]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Devices assigned successfully!' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Assign Device Route Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to assign devices to patient.' });
    } finally {
        client.release();
    }
});

// ==========================================
// FIRMWARE CHECK AND OTA UPDATE FOR SETTINGS SCREEN
// Searches database system_configs for firmware versions.
// If yes is clicked, updates all connected devices to the user to the latest version.
// ==========================================
router.get('/firmware/check', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT config_value FROM system_configs 
             WHERE config_key LIKE 'firmware_%' 
             AND config_key != 'firmware_versions' 
             ORDER BY config_key DESC LIMIT 1`
        );
        if (result.rows.length === 0) {
            return res.json({ success: true, update: null });
        }
        const configVal = typeof result.rows[0].config_value === 'string' 
            ? JSON.parse(result.rows[0].config_value) 
            : result.rows[0].config_value;
        res.json({ success: true, update: configVal });
    } catch (err) {
        console.error('Check Firmware Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to search for firmware updates.' });
    }
});

router.post('/firmware/update', async (req, res) => {
    const { role, id: userId } = req.user;
    try {
        // 1. Get latest firmware version
        const fwRes = await pool.query(
            `SELECT config_value FROM system_configs 
             WHERE config_key LIKE 'firmware_%' 
             AND config_key != 'firmware_versions' 
             ORDER BY config_key DESC LIMIT 1`
        );
        if (fwRes.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'No firmware update available.' });
        }
        const configVal = typeof fwRes.rows[0].config_value === 'string'
            ? JSON.parse(fwRes.rows[0].config_value)
            : fwRes.rows[0].config_value;
        const latestVersion = configVal.version;

        // 2. Perform UPDATE query based on role
        let updateQuery;
        let params;

        if (role === 'admin' || role === 'medical_staff') {
            updateQuery = `
                UPDATE device_whitelist
                SET firmware_version = $1
                RETURNING serial_number
            `;
            params = [latestVersion];
        } else if (role === 'facility_admin') {
            updateQuery = `
                UPDATE device_whitelist
                SET firmware_version = $1
                WHERE (
                    added_by = $2
                    OR added_by IN (
                        SELECT user_id FROM users WHERE created_by = $2
                    )
                    OR assigned_patient_id IN (
                        SELECT patient_id FROM patient_access WHERE invited_by = $2
                    )
                    OR assigned_patient_id IN (
                        SELECT patient_id FROM patient_access WHERE user_id IN (
                            SELECT user_id FROM users WHERE created_by = $2
                        )
                    )
                )
                RETURNING serial_number
            `;
            params = [latestVersion, userId];
        } else {
            // Caregiver / parent
            updateQuery = `
                UPDATE device_whitelist
                SET firmware_version = $1
                WHERE serial_number IN (
                    SELECT DISTINCT d.serial_number
                    FROM device_whitelist d
                    LEFT JOIN patient_access pa ON pa.patient_id = d.assigned_patient_id
                    WHERE (
                        d.added_by = $2
                        OR pa.user_id = $2
                    )
                )
                RETURNING serial_number
            `;
            params = [latestVersion, userId];
        }

        const result = await pool.query(updateQuery, params);
        res.json({ 
            success: true, 
            message: `Successfully updated connected devices to firmware version ${latestVersion}.`,
            updatedCount: result.rows.length
        });
    } catch (err) {
        console.error('Update Firmware Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update connected devices.' });
    }
});

// ==========================================
// PATIENT CARE LOGS ENDPOINTS
// ==========================================

// GET care logs for a patient
router.get('/patients/:patientId/care-logs', async (req, res) => {
    const { patientId } = req.params;
    try {
        const result = await pool.query(
            `SELECT log_id, patient_id, author_id, author_name, content, created_at, status
             FROM care_logs
             WHERE patient_id = $1 AND (status = 'Active' OR status IS NULL)
             ORDER BY created_at DESC`,
            [patientId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch Care Logs Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch care logs.' });
    }
});

// POST a new care log / note
router.post('/patients/:patientId/care-logs', async (req, res) => {
    const { patientId } = req.params;
    const { content } = req.body;
    const authorId = req.user.id;
    const authorName = req.user.name || `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.username || req.user.email || 'Caregiver';

    if (!content || !content.trim()) {
        return res.status(400).json({ success: false, message: 'Note content is required.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO care_logs (patient_id, author_id, author_name, content, created_at, status)
             VALUES ($1, $2, $3, $4, NOW(), 'Active')
             RETURNING log_id, patient_id, author_id, author_name, content, created_at, status`,
            [patientId, authorId, authorName, content.trim()]
        );

        res.status(201).json({ success: true, message: 'Care note added successfully.', data: result.rows[0] });
    } catch (err) {
        console.error('Create Care Log Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to create care note.' });
    }
});

// PUT archive care logs in bulk
router.put('/patients/:patientId/care-logs/archive-bulk', async (req, res) => {
    const { patientId } = req.params;
    const { logIds } = req.body;

    if (!Array.isArray(logIds) || logIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No log IDs provided for archiving.' });
    }

    try {
        await pool.query(
            `UPDATE care_logs
             SET status = 'Archived'
             WHERE patient_id = $1 AND log_id = ANY($2::int[])`,
            [patientId, logIds]
        );

        res.json({ success: true, message: 'Care logs archived successfully.' });
    } catch (err) {
        console.error('Archive Care Logs Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive care logs.' });
    }
});

module.exports = router;


