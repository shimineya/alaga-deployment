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
    
    // Auto-migration: Create preferences column on users table if it does not exist
    pool.query(`
      ALTER TABLE public.users 
      ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb
    `).catch(err => console.error('Failed to run users preferences migration:', err));

    // Auto-migration: Create details column on access_logs table if it does not exist
    pool.query(`
      ALTER TABLE public.access_logs 
      ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb
    `).catch(err => console.error('Failed to run access_logs details migration:', err));

    // Auto-migration: Create details column on archives table if it does not exist
    pool.query(`
      ALTER TABLE public.archives 
      ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb
    `).catch(err => console.error('Failed to run archives details migration:', err));
  }
  if (release) release();
});

module.exports = pool;