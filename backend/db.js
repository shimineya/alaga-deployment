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

    // Auto-migration: Create ip_address column on device_whitelist table if it does not exist
    pool.query(`
      ALTER TABLE public.device_whitelist 
      ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)
    `).catch(err => console.error('Failed to run device_whitelist ip_address migration:', err));

    // Auto-migration: Expand resource_affected column on access_logs to TEXT
    pool.query(`
      ALTER TABLE public.access_logs 
      ALTER COLUMN resource_affected TYPE TEXT
    `).catch(err => console.error('Failed to run access_logs resource_affected migration:', err));

    // Auto-migration: Add is_monitoring_disabled column on patients table if it does not exist
    pool.query(`
      ALTER TABLE public.patients 
      ADD COLUMN IF NOT EXISTS is_monitoring_disabled BOOLEAN DEFAULT FALSE
    `).catch(err => console.error('Failed to run patients is_monitoring_disabled migration:', err));

    // Auto-migration: Expand vital_name column on patient_baselines to VARCHAR(100)
    pool.query(`
      ALTER TABLE public.patient_baselines 
      ALTER COLUMN vital_name TYPE VARCHAR(100)
    `).catch(err => console.error('Failed to run patient_baselines vital_name migration:', err));

    // Auto-migration: Clean up any parent/guardian facility_id associations so home patients remain private
    pool.query(`
      UPDATE public.users 
      SET facility_id = NULL 
      WHERE role IN ('parent', 'guardian') AND facility_id IS NOT NULL;
      
      UPDATE public.patients 
      SET facility_id = NULL 
      WHERE patient_id IN (
          SELECT patient_id FROM public.patient_access WHERE relationship IN ('Parent', 'Guardian')
      ) AND facility_id IS NOT NULL;
    `).catch(err => console.error('Failed to run parent facility_id cleanup migration:', err));
  }
  if (release) release();
});

module.exports = pool;