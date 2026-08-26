const pool = require('../db');

async function main() {
    try {
        console.log('--- Query simulation for user_id = 37 (facility_admin_test) ---');
        const query = `
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
                    ) as latest_telemetry,
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
                WHERE pa.user_id = $1 AND p.is_archived IS DISTINCT FROM TRUE AND (pa.invite_status = 'Active' OR pa.invite_status IS NULL)
                ORDER BY p.patient_id, p.created_at DESC
        `;
        const res = await pool.query(query, [37]);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
