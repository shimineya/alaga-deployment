const pool = require('./db');

async function updateDb() {
  const client = await pool.connect();
  try {
    // 1. Add device_token_hash column if it doesn't exist
    await client.query(`
      ALTER TABLE device_whitelist
      ADD COLUMN IF NOT EXISTS device_token_hash character varying(255);
    `);
    console.log("Added device_token_hash column to device_whitelist.");

    // 2. Set default tokens for existing devices
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update('alaga-test-token').digest('hex');
    
    await client.query(`
      UPDATE device_whitelist
      SET device_token_hash = $1
      WHERE device_token_hash IS NULL;
    `, [tokenHash]);
    console.log("Updated existing devices with default test token hash.");

  } catch (err) {
    console.error("DB Update Error:", err);
  } finally {
    client.release();
    pool.end();
  }
}

updateDb();
