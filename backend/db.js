const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool using settings from .env
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test the connection when the app starts
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error acquiring client', err.stack);
  } else {
    console.log('✅ Connected to PostgreSQL Database (Alaga DB)');
  }
  if (release) release();
});

module.exports = pool;