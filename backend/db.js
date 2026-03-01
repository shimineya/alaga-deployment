const { Pool } = require('pg');
require('dotenv').config();

// [HIPAA / OWASP A04] Environment-aware Database Configuration
// If DATABASE_URL exists (Production/Render), use it with SSL for secure transit. 
// Otherwise, fall back to local pgAdmin credentials for development.
const isProduction = process.env.NODE_ENV === 'production';

const poolConfig = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    // Supabase mandates SSL. rejectUnauthorized: false is standard for managed free-tier DBs
    ssl: isProduction ? { rejectUnauthorized: false } : false
  }
  : {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  };

const pool = new Pool(poolConfig);

// Test the connection when the app starts
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ [System Error] Error acquiring client', err.stack);
  } else {
    console.log(`✅ Connected to PostgreSQL Database (Alaga DB) via ${process.env.DATABASE_URL ? 'Cloud URL' : 'Local Credentials'}`);
  }
  if (release) release();
});

module.exports = pool;