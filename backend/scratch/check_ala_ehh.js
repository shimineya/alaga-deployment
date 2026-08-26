const pool = require('../db');

async function main() {
    try {
        console.log('--- Patients like ala ehh ---');
        const patRes = await pool.query("SELECT patient_id, name, facility_id, is_archived FROM patients WHERE LOWER(name) LIKE '%ala%'");
        console.log(patRes.rows);

        console.log('--- Users like ala ehh ---');
        const userRes = await pool.query("SELECT user_id, username, email, role, facility_id FROM users WHERE LOWER(username) LIKE '%ala%' OR LOWER(first_name) LIKE '%ala%' OR LOWER(last_name) LIKE '%ala%'");
        console.log(userRes.rows);

        console.log('--- Patient Access for Patients like ala ehh ---');
        const accessRes = await pool.query(`
            SELECT pa.*, u.username, p.name as patient_name
            FROM patient_access pa
            JOIN patients p ON pa.patient_id = p.patient_id
            LEFT JOIN users u ON pa.user_id = u.user_id
            WHERE LOWER(p.name) LIKE '%ala%'
        `);
        console.log(accessRes.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
