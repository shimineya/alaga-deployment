require('dotenv').config();
const pool = require('./db');

async function check() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'device_whitelist'
        `);
        console.log("Device Whitelist Columns:");
        console.log(res.rows);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}
check();
