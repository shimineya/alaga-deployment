-- ============================================================================
-- MIGRATION: 006_device_setup_password.sql
-- TARGET: Neon Lakebase Postgres (Alaga Monitoring System)
-- PURPOSE: Add setup_password column to device_whitelist table to store
--          and manage custom WPA2 SoftAP hotspot setup passwords for ESP32 devices.
-- ============================================================================

BEGIN;

-- 1. Ensure setup_password column exists with the default '@Password123'
ALTER TABLE IF EXISTS public.device_whitelist
    ADD COLUMN IF NOT EXISTS setup_password character varying(64) DEFAULT '@Password123';

-- 2. Populate any existing rows where setup_password is null with factory default
UPDATE public.device_whitelist
SET setup_password = '@Password123'
WHERE setup_password IS NULL;

COMMIT;
