-- ============================================================================
-- MIGRATION: 005_device_telemetry_sync.sql
-- TARGET: Neon Lakebase Postgres (Alaga Monitoring System)
-- PURPOSE: Ensure schema columns and high-performance composite indices
--          for multi-sensor telemetry carry-forward, device heartbeat, battery,
--          wireless signal diagnostics, and dashboard synchronization.
-- ============================================================================

BEGIN;

-- 1. Ensure device_whitelist has all telemetry & diagnostic columns
ALTER TABLE IF EXISTS public.device_whitelist
    ADD COLUMN IF NOT EXISTS battery_level integer,
    ADD COLUMN IF NOT EXISTS signal_strength character varying(20),
    ADD COLUMN IF NOT EXISTS ip_address character varying(45),
    ADD COLUMN IF NOT EXISTS last_heartbeat timestamp with time zone,
    ADD COLUMN IF NOT EXISTS assigned_patient_id integer,
    ADD COLUMN IF NOT EXISTS pending_firmware_version character varying(50),
    ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- 2. Foreign Key: device_whitelist -> patients (safe idempotent creation)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'device_whitelist_assigned_patient_id_fkey'
    ) THEN
        ALTER TABLE public.device_whitelist
            ADD CONSTRAINT device_whitelist_assigned_patient_id_fkey
            FOREIGN KEY (assigned_patient_id)
            REFERENCES public.patients (patient_id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Composite Indices for Fast Telemetry Lookups on Neon
-- Optimizes the 2-minute active heartbeat check:
CREATE INDEX IF NOT EXISTS idx_device_whitelist_patient_active 
    ON public.device_whitelist (assigned_patient_id, status, last_heartbeat)
    WHERE is_archived IS DISTINCT FROM true;

-- Optimizes carry-forward snapshot query:
-- SELECT ... FROM sensor_readings WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT 1
CREATE INDEX IF NOT EXISTS idx_sensor_readings_patient_recorded_desc 
    ON public.sensor_readings (patient_id, recorded_at DESC);

-- Optimizes vital history time-series lookups (Day, Week, Month trends):
CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at 
    ON public.sensor_readings (recorded_at);

COMMIT;
