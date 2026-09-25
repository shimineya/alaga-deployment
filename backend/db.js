const { Pool, types } = require('pg');
require('dotenv').config();

// Keep PostgreSQL DATE (OID 1082) as exact 'YYYY-MM-DD' strings without timezone conversion
types.setTypeParser(1082, (val) => val);

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

    // Auto-migration: Create facility_invitations table
    pool.query(`
      CREATE TABLE IF NOT EXISTS public.facility_invitations (
        invitation_id SERIAL PRIMARY KEY,
        facility_id INTEGER NOT NULL REFERENCES facilities(facility_id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        token VARCHAR(64) UNIQUE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
        used_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        used_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_facility_invitations_token ON public.facility_invitations (token);
      CREATE INDEX IF NOT EXISTS idx_facility_invitations_facility ON public.facility_invitations (facility_id);
    `).catch(err => console.error('Failed to run facility_invitations migration:', err));
  }
  if (release) release();
});

module.exports = pool;