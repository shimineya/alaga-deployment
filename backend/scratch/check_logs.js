const pool = require('../db');

async function main() {
    try {
        console.log('--- Recent Access Logs ---');
        const logRes = await pool.query("SELECT * FROM access_logs ORDER BY log_id DESC LIMIT 30");
        console.log(logRes.rows);

        console.log('--- Recent Archives ---');
        const arcRes = await pool.query("SELECT * FROM archives ORDER BY archive_id DESC LIMIT 10");
        console.log(arcRes.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
