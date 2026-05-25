require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkDb() {
  try {
    const res = await pool.query("SELECT * FROM system_configs WHERE config_key = 'smtp_config'");
    console.log("system_configs:", res.rows);
    
    const userRes = await pool.query("SELECT * FROM users ORDER BY created_at DESC LIMIT 5");
    console.log("Recent Users:", userRes.rows.map(u => ({ email: u.email, is_verified: u.is_verified })));
    
    const otpRes = await pool.query("SELECT * FROM user_email_otps ORDER BY created_at DESC LIMIT 5");
    console.log("Recent OTPs:", otpRes.rows.map(o => ({ email: o.email, purpose: o.purpose, created_at: o.created_at })));
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
checkDb();
