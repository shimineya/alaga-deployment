const pool = require('../db');

async function main() {
    try {
        console.log('--- Patients named Hihi Hoho ---');
        const patRes = await pool.query("SELECT patient_id, name, facility_id, is_archived FROM patients WHERE LOWER(name) = LOWER('Hihi Hoho')");
        console.log(patRes.rows);

        console.log('--- Facility Admins ---');
        const adminRes = await pool.query("SELECT user_id, username, email, role, facility_id FROM users WHERE role = 'facility_admin'");
        console.log(adminRes.rows);

        console.log('--- Facilities ---');
        const facRes = await pool.query("SELECT * FROM facilities");
        console.log(facRes.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
