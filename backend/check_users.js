const pool = require('./db');

async function checkUsers() {
    try {
        const res = await pool.query("SELECT user_id, username, email, role, account_status FROM users");
        console.table(res.rows);
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
