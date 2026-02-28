-- =================================================================
-- MIGRATION: 002 - Dual Admin Architecture & RBAC
-- DATE: 2026-02-26
-- MANDATE: DPA 2012 (Data Minimization), HIPAA (Access Control),
--          OWASP A01 (Broken Access Control Prevention)
-- =================================================================

-- -----------------------------------------------------------------
-- 1. FACILITIES TABLE
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facilities (
    facility_id SERIAL PRIMARY KEY,
    facility_name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a default facility so existing data has a valid FK target
INSERT INTO facilities (facility_name, address)
VALUES ('Default Facility', 'Main Campus')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------
-- 2. ADD facility_id TO EXISTING TABLES
-- -----------------------------------------------------------------

-- [OWASP A01] Row-Level Security: All users belong to a facility
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS facility_id INTEGER REFERENCES facilities(facility_id);

-- [OWASP A01] Row-Level Security: All patients belong to a facility
ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS facility_id INTEGER REFERENCES facilities(facility_id);

-- Assign all existing users and patients to the default facility
UPDATE users SET facility_id = 1 WHERE facility_id IS NULL;
UPDATE patients SET facility_id = 1 WHERE facility_id IS NULL;

-- -----------------------------------------------------------------
-- 3. SESSION REVOCATIONS TABLE (Kill Switch)
-- [HIPAA] Immediate access termination on compromise
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_revocations (
    user_id     INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    revoked_before TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_by  INTEGER REFERENCES users(user_id),
    reason      TEXT
);

-- -----------------------------------------------------------------
-- 4. SERVER-SIDE RBAC: ROLE-LEVEL MODULE PERMISSIONS
-- [OWASP A01] Replaces insecure localStorage-based permissions
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
    id          SERIAL PRIMARY KEY,
    role        VARCHAR(50) NOT NULL,
    module_id   VARCHAR(100) NOT NULL,
    is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by  INTEGER REFERENCES users(user_id),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, module_id)
);

-- Seed default permissions for existing roles
INSERT INTO role_permissions (role, module_id, is_enabled) VALUES
    ('caregiver', 'dashboard', TRUE),
    ('caregiver', 'my-patients', TRUE),
    ('caregiver', 'add-patient', TRUE),
    ('caregiver', 'bulletin', TRUE),
    ('caregiver', 'alerts', TRUE),
    ('caregiver', 'reports', TRUE),
    ('caregiver', 'analytics', TRUE),
    ('caregiver', 'vital-signs', TRUE),
    ('caregiver', 'device-status', TRUE),
    ('caregiver', 'archived', TRUE),
    ('caregiver', 'settings', TRUE),
    ('caregiver', 'profile', TRUE),
    ('medical_staff', 'dashboard', TRUE),
    ('medical_staff', 'master-list', TRUE),
    ('medical_staff', 'add-patient', TRUE),
    ('medical_staff', 'bulletin', TRUE),
    ('medical_staff', 'alerts-medical', TRUE),
    ('medical_staff', 'reports', TRUE),
    ('medical_staff', 'health-trends', TRUE),
    ('medical_staff', 'activity-logs', TRUE),
    ('medical_staff', 'sensor-health', TRUE),
    ('medical_staff', 'archived', TRUE),
    ('medical_staff', 'system-settings', TRUE),
    ('medical_staff', 'profile', TRUE)
ON CONFLICT (role, module_id) DO NOTHING;

-- -----------------------------------------------------------------
-- 5. GRANULAR RBAC: PER-USER PERMISSION OVERRIDES
-- [OWASP A01] Allows exceptions to role-level defaults
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_permission_overrides (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    module_id       VARCHAR(100) NOT NULL,
    -- TRUE = grant even if role denies; FALSE = deny even if role allows
    is_granted      BOOLEAN NOT NULL,
    override_reason TEXT,
    overridden_by   INTEGER REFERENCES users(user_id),
    overridden_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, module_id)
);

-- =================================================================
-- END MIGRATION
-- =================================================================
