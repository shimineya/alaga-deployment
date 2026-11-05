-- ============================================================================
-- ALAGA SMART HEALTHCARE MONITORING SYSTEM — NEON DB MIGRATION QUERY
-- Purpose:
--   1. Ensure permanently unpaired devices remain registered in the inventory
--      as Unassigned (`assigned_patient_id = NULL`, `status = 'AVAILABLE'`).
--   2. Ensure `device_whitelist` and `devices` allow NULL patient assignments
--      and support all real-time lifecycle statuses (`AVAILABLE`, `STANDBY`,
--      `ACTIVE`, `INACTIVE`, `MAINTENANCE`, `DECOMMISSIONED`).
--   3. Ensure `device_snapshots`, `access_logs`, and real-time lookup indexes
--      exist for fast SSE synchronization across Web and Mobile apps.
-- ============================================================================

BEGIN;

-- 1. Ensure all required columns exist on public.device_whitelist
ALTER TABLE public.device_whitelist
  ADD COLUMN IF NOT EXISTS added_by INTEGER,
  ADD COLUMN IF NOT EXISTS assigned_patient_id INTEGER,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_firmware_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS battery_level INTEGER,
  ADD COLUMN IF NOT EXISTS signal_strength VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
  ADD COLUMN IF NOT EXISTS setup_password VARCHAR(64) DEFAULT '@Password123';

-- 2. Allow assigned_patient_id to be NULL when a device is permanently unpaired
--    so the device remains registered in the user's inventory as Unassigned
ALTER TABLE public.device_whitelist
  ALTER COLUMN assigned_patient_id DROP NOT NULL;

-- 3. Drop any legacy restrictive CHECK constraint on device_whitelist.status
--    that would block 'AVAILABLE' or 'STANDBY'
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.device_whitelist'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.device_whitelist DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- 4. Normalize any currently unassigned devices so they are marked AVAILABLE (Unassigned)
UPDATE public.device_whitelist
SET status = 'AVAILABLE',
    signal_strength = 'Offline'
WHERE assigned_patient_id IS NULL
  AND is_archived IS DISTINCT FROM TRUE
  AND (status IS NULL OR status IN ('INACTIVE', 'UNASSIGNED', 'ACTIVE'));

-- 5. Update legacy public.devices table (if present) so patient_id can be NULL when unpaired
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'devices'
  ) THEN
    ALTER TABLE public.devices
      ADD COLUMN IF NOT EXISTS registered_by INTEGER,
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'AVAILABLE',
      ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50) DEFAULT 'v1.0.0';

    ALTER TABLE public.devices
      ALTER COLUMN patient_id DROP NOT NULL;

    UPDATE public.devices
    SET status = 'AVAILABLE'
    WHERE patient_id IS NULL
      AND (status IS NULL OR status IN ('INACTIVE', 'UNASSIGNED', 'ACTIVE'));
  END IF;
END $$;

-- 6. Ensure public.device_snapshots exists for audit/snapshot retention
CREATE TABLE IF NOT EXISTS public.device_snapshots (
  snapshot_id SERIAL PRIMARY KEY,
  serial_number VARCHAR(64) NOT NULL,
  device_name VARCHAR(120),
  firmware_version VARCHAR(50),
  last_status VARCHAR(30),
  battery_level INTEGER,
  signal_strength VARCHAR(50),
  assigned_patient_id INTEGER,
  assigned_patient_name VARCHAR(255),
  facility_id INTEGER,
  facility_name VARCHAR(255),
  telemetry_count INTEGER DEFAULT 0,
  alerts_count INTEGER DEFAULT 0,
  snapshot_data JSONB DEFAULT '{}'::jsonb,
  deleted_by VARCHAR(255),
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Ensure real-time query indexes exist
CREATE INDEX IF NOT EXISTS idx_device_whitelist_assigned_patient ON public.device_whitelist (assigned_patient_id);
CREATE INDEX IF NOT EXISTS idx_device_whitelist_added_by ON public.device_whitelist (added_by);
CREATE INDEX IF NOT EXISTS idx_device_whitelist_status ON public.device_whitelist (status);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_patient_recorded ON public.sensor_readings (patient_id, recorded_at DESC);

COMMIT;
