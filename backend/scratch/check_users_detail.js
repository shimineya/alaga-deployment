const pool = require('../db');

async function main() {
    try {
        const res = await pool.query("SELECT user_id, username, first_name, last_name FROM users WHERE user_id IN (37, 39)");
        console.log(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
