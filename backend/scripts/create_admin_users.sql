-- =============================================================================
-- ALAGA Monitoring System — Admin User Seed Script
-- =============================================================================
-- PURPOSE  : Creates a Facility Admin and a System Admin account for initial
--            system setup and demonstration use.
-- RUN IN   : pgAdmin 4 > Query Tool (connected to the "alaga_db" database)
-- ORDER    : Run this AFTER the main ERD / schema script (UpdatedERD.sql)
--
-- PASSWORDS (change immediately after first login):
--   Facility Admin : FacAdmin@2025!
--   System Admin   : SysAdmin@2025!
--
-- [OWASP A04] Hashes were generated with bcrypt + 12 salt rounds using
--             generate_admin_hashes.js — NOT stored in plain text.
-- [DPA 2012]  Per the principle of data minimisation, only the fields
--             strictly required for authentication are populated here.
--             Additional profile data should be completed via the UI.
-- [HIPAA]     Change all seed passwords on first login. Revoke these
--             accounts if they are not in active use.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- STEP 1: Ensure at least one Facility exists (required by the FK on users)
--         Skip this block if a facility row already exists in your database.
-- ---------------------------------------------------------------------------
INSERT INTO public.facilities (facility_name, address)
SELECT 'Alaga General Hospital', 'Metro Manila, Philippines'
WHERE NOT EXISTS (
    SELECT 1 FROM public.facilities WHERE facility_name = 'Alaga General Hospital'
);

-- ---------------------------------------------------------------------------
-- STEP 2: Capture the facility_id we will assign to the Facility Admin.
--         The System Admin is NOT scoped to a single facility (NULL).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_facility_id INTEGER;
    v_facility_admin_id INTEGER;
    v_system_admin_id   INTEGER;
BEGIN

    SELECT facility_id INTO v_facility_id
    FROM public.facilities
    WHERE facility_name = 'Alaga General Hospital'
    LIMIT 1;

    -- -----------------------------------------------------------------------
    -- STEP 3: Create the Facility Admin account
    -- -----------------------------------------------------------------------
    -- [OWASP A04] password_hash = bcrypt('FacAdmin@2025!', saltRounds=12)
    -- [OWASP A07] account is pre-verified and set Active so login works
    --             immediately without the email-OTP verification step.
    -- -----------------------------------------------------------------------
    INSERT INTO public.users (
        username,
        password_hash,
        email,
        first_name,
        last_name,
        role,
        account_status,
        is_verified,
        is_locked,
        failed_login_attempts,
        facility_id,
        created_at
    )
    SELECT
        'facility_admin',
        '$2b$12$ovY763Gh.osw0hf8MXr3W.eIqp6MZBPIczAGUMK8ZPhI.x1GIPK.m',
        'facility.admin@alaga.local',
        'Facility',
        'Administrator',
        'facility_admin',
        'Active',
        TRUE,
        FALSE,
        0,
        v_facility_id,
        NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM public.users WHERE username = 'facility_admin'
    )
    RETURNING user_id INTO v_facility_admin_id;

    IF v_facility_admin_id IS NOT NULL THEN
        RAISE NOTICE '[OK] Facility Admin created with user_id = %', v_facility_admin_id;
    ELSE
        RAISE NOTICE '[SKIP] Facility Admin already exists — no changes made.';
    END IF;

    -- -----------------------------------------------------------------------
    -- STEP 4: Create the System Admin account
    -- -----------------------------------------------------------------------
    -- [OWASP A04] password_hash = bcrypt('SysAdmin@2025!', saltRounds=12)
    -- [OWASP A01] role = 'system_admin' grants the highest privilege tier.
    --             This account bypasses RBAC module checks (verifySuperAdmin).
    --             Restrict physical and logical access accordingly.
    -- [HIPAA]     All actions taken by this account are recorded in access_logs.
    -- -----------------------------------------------------------------------
    INSERT INTO public.users (
        username,
        password_hash,
        email,
        first_name,
        last_name,
        role,
        account_status,
        is_verified,
        is_locked,
        failed_login_attempts,
        facility_id,    -- NULL = omniscient view across all facilities
        created_at
    )
    SELECT
        'system_admin',
        '$2b$12$.D2LElZ.LfxfkEc34myrDep1fCvgEda0fLJKrZK3q812KX9W2svZG',
        'system.admin@alaga.local',
        'System',
        'Administrator',
        'system_admin',
        'Active',
        TRUE,
        FALSE,
        0,
        NULL,
        NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM public.users WHERE username = 'system_admin'
    )
    RETURNING user_id INTO v_system_admin_id;

    IF v_system_admin_id IS NOT NULL THEN
        RAISE NOTICE '[OK] System Admin created with user_id = %', v_system_admin_id;
    ELSE
        RAISE NOTICE '[SKIP] System Admin already exists — no changes made.';
    END IF;

END $$;

-- ---------------------------------------------------------------------------
-- STEP 5: Verify the seed data
-- ---------------------------------------------------------------------------
SELECT
    user_id,
    username,
    email,
    role,
    account_status,
    is_verified,
    facility_id,
    created_at
FROM public.users
WHERE username IN ('facility_admin', 'system_admin')
ORDER BY user_id;

COMMIT;

-- =============================================================================
-- POST-RUN CHECKLIST (complete these in the Alaga web UI after running)
-- =============================================================================
-- [ ] Log in as system_admin  (SysAdmin@2025!)   and change the password.
-- [ ] Log in as facility_admin (FacAdmin@2025!)  and change the password.
-- [ ] In the System Admin dashboard, verify both accounts appear in Users.
-- [ ] Confirm the Facility Admin is linked to the correct facility.
-- [ ] Revoke or delete these seed accounts if not needed in production.
-- =============================================================================
