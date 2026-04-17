const pool = require('./db');
pool.query('SELECT user_id, username, email, mobile_number FROM users LIMIT 2')
    .then(res => {
        console.log("DB RESULT:");
        console.log(res.rows);
    })
    .catch(err => console.error("ERR:", err))
    .finally(() => pool.end());
