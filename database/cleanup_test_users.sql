-- ==============================================================================
-- ALAGA HEALTHCARE MONITORING SYSTEM — CLEANUP SCRIPT
-- Target: Neon PostgreSQL (Lakebase) & Local PostgreSQL
-- Purpose: Permanently purge all records, consents, OTPs, invitations, and
--          associated clinical and audit links for:
--            - cabnels42@gmail.com
--            - reallyjanedope@gmail.com
-- ==============================================================================

BEGIN;

-- 1. Create a temporary table containing the target user IDs
CREATE TEMP TABLE target_cleanup_users AS
SELECT user_id, email, username 
FROM public.users 
WHERE LOWER(TRIM(email)) IN ('cabnels42@gmail.com', 'reallyjanedope@gmail.com');

-- 2. Delete Email OTP verification records (by user_id and email)
DELETE FROM public.user_email_otps
WHERE user_id IN (SELECT user_id FROM target_cleanup_users)
   OR LOWER(TRIM(email)) IN ('cabnels42@gmail.com', 'reallyjanedope@gmail.com');

-- 3. Delete Facility Invitations (by email, creator, and recipient)
DELETE FROM public.facility_invitations
WHERE LOWER(TRIM(email)) IN ('cabnels42@gmail.com', 'reallyjanedope@gmail.com')
   OR created_by IN (SELECT user_id FROM target_cleanup_users)
   OR used_by IN (SELECT user_id FROM target_cleanup_users);

-- 4. Delete Legal & Clinical Consent Audit Trails
DELETE FROM public.user_consents
WHERE user_id IN (SELECT user_id FROM target_cleanup_users);

-- 5. Delete Uploaded User Documents
DELETE FROM public.user_documents
WHERE user_id IN (SELECT user_id FROM target_cleanup_users)
   OR reviewed_by IN (SELECT user_id FROM target_cleanup_users);

-- 6. Delete Role Profiles
DELETE FROM public.profiles_caregivers
WHERE user_id IN (SELECT user_id FROM target_cleanup_users);

DELETE FROM public.profiles_medical_staff
WHERE user_id IN (SELECT user_id FROM target_cleanup_users);

-- 7. Delete Patient Access & Assignment links
DELETE FROM public.patient_access
WHERE user_id IN (SELECT user_id FROM target_cleanup_users)
   OR invited_by IN (SELECT user_id FROM target_cleanup_users);

-- 8. Delete Alert Notifications sent to or acknowledged by target users
DELETE FROM public.alert_notifications
WHERE user_id IN (SELECT user_id FROM target_cleanup_users)
   OR acknowledged_by IN (SELECT user_id FROM target_cleanup_users);

-- 9. Delete Care Logs authored by target users
DELETE FROM public.care_logs
WHERE author_id IN (SELECT user_id FROM target_cleanup_users);

-- 10. Delete Generated Reports & Session Revocations
DELETE FROM public.reports
WHERE user_id IN (SELECT user_id FROM target_cleanup_users);

DELETE FROM public.session_revocations
WHERE user_id IN (SELECT user_id FROM target_cleanup_users)
   OR revoked_by IN (SELECT user_id FROM target_cleanup_users);

-- 11. Delete Access & Audit Logs
DELETE FROM public.access_logs
WHERE user_id IN (SELECT user_id FROM target_cleanup_users);

-- 12. Nullify Foreign Key creator/updater references on shared institutional records
UPDATE public.users 
SET created_by = NULL 
WHERE created_by IN (SELECT user_id FROM target_cleanup_users);

UPDATE public.announcements 
SET created_by = NULL 
WHERE created_by IN (SELECT user_id FROM target_cleanup_users);

UPDATE public.archives 
SET archived_by = NULL 
WHERE archived_by IN (SELECT user_id FROM target_cleanup_users);

UPDATE public.device_whitelist 
SET added_by = NULL 
WHERE added_by IN (SELECT user_id FROM target_cleanup_users);

UPDATE public.hardware_system_alerts 
SET resolved_by = NULL 
WHERE resolved_by IN (SELECT user_id FROM target_cleanup_users);

UPDATE public.ip_blacklist 
SET banned_by = NULL 
WHERE banned_by IN (SELECT user_id FROM target_cleanup_users);

UPDATE public.legal_documents 
SET created_by = NULL 
WHERE created_by IN (SELECT user_id FROM target_cleanup_users);

UPDATE public.role_permissions 
SET updated_by = NULL 
WHERE updated_by IN (SELECT user_id FROM target_cleanup_users);

UPDATE public.system_configs 
SET updated_by = NULL 
WHERE updated_by IN (SELECT user_id FROM target_cleanup_users);

-- 13. Finally, delete the Users accounts
DELETE FROM public.users
WHERE LOWER(TRIM(email)) IN ('cabnels42@gmail.com', 'reallyjanedope@gmail.com');

-- Drop temporary table
DROP TABLE IF EXISTS target_cleanup_users;

COMMIT;

-- ------------------------------------------------------------------------------
-- Verification Query: Ensure 0 rows remain
-- ------------------------------------------------------------------------------
SELECT 'users' AS table_name, count(*) AS remaining_count 
FROM public.users 
WHERE LOWER(TRIM(email)) IN ('cabnels42@gmail.com', 'reallyjanedope@gmail.com')
UNION ALL
SELECT 'user_email_otps', count(*) 
FROM public.user_email_otps 
WHERE LOWER(TRIM(email)) IN ('cabnels42@gmail.com', 'reallyjanedope@gmail.com')
UNION ALL
SELECT 'facility_invitations', count(*) 
FROM public.facility_invitations 
WHERE LOWER(TRIM(email)) IN ('cabnels42@gmail.com', 'reallyjanedope@gmail.com');
