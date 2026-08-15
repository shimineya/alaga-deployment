const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    };

const pool = new Pool(poolConfig);

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ [System Error] Error acquiring client', err.stack);
  } else {
    console.log(`✅ Connected to PostgreSQL Database (Alaga DB) via ${process.env.DATABASE_URL ? 'Cloud URL' : 'Local Credentials'}`);
  }
  if (release) release();
});

module.exports = pool;