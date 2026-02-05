-- =============================================
-- MIGRATION SCRIPT: PRIVACY & FORMAT SUPPORT
-- GOAL: Rename MAC Address columns to Serial Number
-- REASON: User Privacy & Support for Custom Formats
-- =============================================

BEGIN;

-- 1. Alter device_whitelist table
-- Rename column
ALTER TABLE device_whitelist 
RENAME COLUMN mac_address TO serial_number;

-- Change type to VARCHAR(50) (supports VS-2025-001)
ALTER TABLE device_whitelist 
ALTER COLUMN serial_number TYPE VARCHAR(50);


-- 2. Alter patients table
-- Rename column
ALTER TABLE patients 
RENAME COLUMN device_mac_address TO device_serial_number;

-- Change type to VARCHAR(50)
ALTER TABLE patients 
ALTER COLUMN device_serial_number TYPE VARCHAR(50);


-- 3. Update Constraints (if necessary)
-- Note: Foreign Keys usually follow the rename automatically in Postgres,
-- but good to verify downstream logic in backend code.

COMMIT;
