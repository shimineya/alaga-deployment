-- ============================================================================
-- ALAGA HEALTHCARE MONITORING SYSTEM
-- FULL DATABASE SCHEMA DUMP FOR NEON POSTGRESQL (Lakebase Postgres)
-- Generated on: 2026-09-09T21:04:09.877Z
-- Platform: Neon Cloud Serverless Postgres / PostgreSQL 15+
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- TABLE: facilities
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.facilities (
    facility_id SERIAL,
    facility_name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    topology JSONB DEFAULT '[]'::jsonb,
    is_archived BOOLEAN DEFAULT false,
    CONSTRAINT facilities_pkey PRIMARY KEY (facility_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    user_id SERIAL,
    username VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    role VARCHAR(20) NOT NULL,
    is_biometric_enabled BOOLEAN DEFAULT false,
    is_mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    mfa_method VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT false,
    account_status VARCHAR(20) DEFAULT 'Pending_Review'::character varying,
    mobile_number VARCHAR(20),
    middle_initial VARCHAR(5),
    is_locked BOOLEAN DEFAULT false,
    failed_login_attempts INTEGER DEFAULT 0,
    force_logout_at TIMESTAMP WITH TIME ZONE,
    facility_id INTEGER,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    profile_picture_url VARCHAR(255),
    created_by INTEGER,
    is_archived BOOLEAN DEFAULT false,
    preferences JSONB DEFAULT '{}'::jsonb,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT users_pkey PRIMARY KEY (user_id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_username_key UNIQUE (username)
);

-- ----------------------------------------------------------------------------
-- TABLE: patients
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patients (
    patient_id SERIAL,
    name VARCHAR(100) NOT NULL,
    birthdate DATE NOT NULL,
    patient_type VARCHAR(50),
    device_serial_number VARCHAR(50),
    baseline_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT false,
    facility_id INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    svm_baseline_data JSONB,
    baseline_reset_at TIMESTAMP WITH TIME ZONE,
    is_monitoring_disabled BOOLEAN DEFAULT false,
    CONSTRAINT patients_pkey PRIMARY KEY (patient_id),
    CONSTRAINT patients_device_mac_address_key UNIQUE (device_serial_number)
);

-- ----------------------------------------------------------------------------
-- TABLE: system_modules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_modules (
    module_id VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    CONSTRAINT system_modules_pkey PRIMARY KEY (module_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: system_configs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_configs (
    config_key VARCHAR(50) NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_by INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_archived BOOLEAN DEFAULT false,
    CONSTRAINT system_configs_pkey PRIMARY KEY (config_key)
);

-- ----------------------------------------------------------------------------
-- TABLE: device_whitelist
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.device_whitelist (
    serial_number VARCHAR(50) NOT NULL,
    device_name VARCHAR(50),
    firmware_version VARCHAR(20),
    status VARCHAR(20) DEFAULT 'ACTIVE'::character varying,
    added_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    assigned_patient_id INTEGER,
    last_serviced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    device_token_hash VARCHAR(255),
    is_archived BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    pending_firmware_version VARCHAR(50),
    battery_level INTEGER,
    signal_strength VARCHAR(20),
    ip_address VARCHAR(45),
    CONSTRAINT device_whitelist_pkey PRIMARY KEY (serial_number)
);

-- ----------------------------------------------------------------------------
-- TABLE: device_snapshots
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.device_snapshots (
    snapshot_id SERIAL,
    device_id INTEGER,
    serial_number VARCHAR(100) NOT NULL,
    device_name VARCHAR(100),
    mac_address VARCHAR(100),
    firmware_version VARCHAR(50),
    assigned_patient_id INTEGER,
    assigned_patient_name VARCHAR(255),
    facility_id INTEGER,
    facility_name VARCHAR(255),
    telemetry_count INTEGER DEFAULT 0,
    alerts_count INTEGER DEFAULT 0,
    snapshot_data JSONB,
    deleted_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_archived BOOLEAN DEFAULT false,
    CONSTRAINT device_snapshots_pkey PRIMARY KEY (snapshot_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: access_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_logs (
    log_id BIGSERIAL,
    user_id INTEGER,
    target_patient_id INTEGER,
    action VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    resource_affected TEXT,
    severity VARCHAR(20) DEFAULT 'INFO'::character varying,
    status VARCHAR(20) DEFAULT 'SUCCESS'::character varying,
    details JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT access_logs_pkey PRIMARY KEY (log_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: alert_notifications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alert_notifications (
    alert_id SERIAL,
    event_id INTEGER,
    user_id INTEGER,
    status VARCHAR(20) DEFAULT 'Sent'::character varying,
    message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    severity VARCHAR(20) DEFAULT 'INFO'::character varying,
    alert_category VARCHAR(50) DEFAULT 'Clinical'::character varying,
    acknowledged_by INTEGER,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    action_taken VARCHAR(255),
    resolution_notes TEXT,
    CONSTRAINT alert_notifications_pkey PRIMARY KEY (alert_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: announcements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
    id SERIAL,
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_archived BOOLEAN DEFAULT false,
    CONSTRAINT announcements_pkey PRIMARY KEY (id)
);

-- ----------------------------------------------------------------------------
-- TABLE: anomaly_events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.anomaly_events (
    event_id SERIAL,
    patient_id INTEGER,
    reading_id BIGINT,
    anomaly_type VARCHAR(50),
    ocsvm_score NUMERIC(10, 4),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT anomaly_events_pkey PRIMARY KEY (event_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: archives
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.archives (
    archive_id SERIAL,
    entity_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    target_name VARCHAR(255) NOT NULL,
    archived_by INTEGER,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Archived'::character varying,
    facility_id INTEGER,
    details JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT archives_pkey PRIMARY KEY (archive_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: care_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.care_logs (
    log_id SERIAL,
    patient_id INTEGER NOT NULL,
    author_id INTEGER,
    author_name VARCHAR(100),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Active'::character varying,
    CONSTRAINT care_logs_pkey PRIMARY KEY (log_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: hardware_system_alerts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hardware_system_alerts (
    sys_alert_id SERIAL,
    patient_id INTEGER,
    device_mac_address VARCHAR(50),
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'Warning'::character varying,
    description TEXT,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Active'::character varying,
    resolved_by INTEGER,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    CONSTRAINT hardware_system_alerts_pkey PRIMARY KEY (sys_alert_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: ip_blacklist
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ip_blacklist (
    id SERIAL,
    ip_address VARCHAR(45) NOT NULL,
    reason TEXT,
    banned_by INTEGER,
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_archived BOOLEAN DEFAULT false,
    CONSTRAINT ip_blacklist_pkey PRIMARY KEY (id),
    CONSTRAINT ip_blacklist_ip_address_key UNIQUE (ip_address)
);

-- ----------------------------------------------------------------------------
-- TABLE: legal_documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_documents (
    doc_id SERIAL,
    doc_type VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    version VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_by INTEGER,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT legal_documents_pkey PRIMARY KEY (doc_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: patient_access
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_access (
    access_id SERIAL,
    user_id INTEGER,
    patient_id INTEGER,
    relationship VARCHAR(50),
    access_level VARCHAR(20) DEFAULT 'View'::character varying,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    invite_status VARCHAR(20) DEFAULT 'Active'::character varying,
    invited_by INTEGER,
    is_archived BOOLEAN DEFAULT false,
    CONSTRAINT patient_access_pkey PRIMARY KEY (access_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: patient_baselines
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_baselines (
    baseline_id SERIAL,
    patient_id INTEGER NOT NULL,
    vital_name VARCHAR(100) NOT NULL,
    flag_count INTEGER DEFAULT 0 NOT NULL,
    flagged_values JSONB DEFAULT '[]'::jsonb NOT NULL,
    mean_value NUMERIC(6, 2),
    upper_bound NUMERIC(6, 2),
    lower_bound NUMERIC(6, 2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT patient_baselines_pkey PRIMARY KEY (baseline_id),
    CONSTRAINT patient_baselines_patient_vital_key UNIQUE (patient_id, vital_name)
);

-- ----------------------------------------------------------------------------
-- TABLE: profiles_caregivers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles_caregivers (
    profile_id SERIAL,
    user_id INTEGER,
    caregiver_type VARCHAR(50),
    certifications TEXT[],
    years_experience INTEGER,
    agency_name VARCHAR(150),
    emergency_contact VARCHAR(50),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    work_shift VARCHAR(50),
    notification_preferences TEXT[],
    CONSTRAINT profiles_caregivers_pkey PRIMARY KEY (profile_id),
    CONSTRAINT profiles_caregivers_user_id_key UNIQUE (user_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: profiles_medical_staff
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles_medical_staff (
    profile_id SERIAL,
    user_id INTEGER,
    license_number VARCHAR(50) NOT NULL,
    specialization VARCHAR(100),
    hospital_affiliation VARCHAR(150),
    years_of_practice INTEGER,
    schedule_availability JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    practice_type VARCHAR(50),
    is_solo_practitioner BOOLEAN DEFAULT false,
    CONSTRAINT profiles_medical_staff_pkey PRIMARY KEY (profile_id),
    CONSTRAINT profiles_medical_staff_license_number_key UNIQUE (license_number),
    CONSTRAINT profiles_medical_staff_user_id_key UNIQUE (user_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: reports
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    report_id SERIAL,
    user_id INTEGER,
    patient_id INTEGER,
    report_type VARCHAR(50),
    file_url VARCHAR(255),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reports_pkey PRIMARY KEY (report_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: role_permissions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id SERIAL,
    role VARCHAR(50) NOT NULL,
    module_id VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT true NOT NULL,
    updated_by INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
    CONSTRAINT role_permissions_role_module_id_key UNIQUE (role, module_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: schedules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedules (
    schedule_id SERIAL,
    patient_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    custom_event_name TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_interval VARCHAR(50),
    scheduled_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending'::character varying,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT false,
    CONSTRAINT schedules_pkey PRIMARY KEY (schedule_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: sensor_readings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sensor_readings (
    reading_id BIGSERIAL,
    patient_id INTEGER,
    heart_rate INTEGER,
    spo2 INTEGER,
    temperature NUMERIC(5, 2),
    moisture_value INTEGER,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sensor_readings_pkey PRIMARY KEY (reading_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: session_revocations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_revocations (
    user_id INTEGER NOT NULL,
    revoked_before TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    revoked_by INTEGER,
    reason TEXT,
    CONSTRAINT session_revocations_pkey PRIMARY KEY (user_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: system_reports
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_reports (
    report_id SERIAL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) DEFAULT 'INFO'::character varying,
    summary TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    generated_by VARCHAR(100) DEFAULT 'SYSTEM'::character varying,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT system_reports_pkey PRIMARY KEY (report_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: user_documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_documents (
    document_id SERIAL,
    user_id INTEGER,
    document_type VARCHAR(50) NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verification_status VARCHAR(20) DEFAULT 'Pending'::character varying,
    reviewed_by INTEGER,
    rejection_reason TEXT,
    CONSTRAINT user_documents_pkey PRIMARY KEY (document_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: user_email_otps
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_email_otps (
    otp_id SERIAL,
    user_id INTEGER NOT NULL,
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(6),
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    purpose VARCHAR(50) DEFAULT 'REGISTRATION'::character varying,
    consumed_at TIMESTAMP WITH TIME ZONE,
    otp_hash VARCHAR(255),
    last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    attempts_count INTEGER DEFAULT 0,
    CONSTRAINT user_email_otps_pkey PRIMARY KEY (otp_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: user_firmware_downloads
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_firmware_downloads (
    download_id SERIAL,
    user_id INTEGER,
    firmware_version VARCHAR(50),
    device_type VARCHAR(50),
    download_url TEXT,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status VARCHAR(50) DEFAULT 'COMPLETED'::character varying,
    CONSTRAINT user_firmware_downloads_pkey PRIMARY KEY (download_id)
);

-- ----------------------------------------------------------------------------
-- TABLE: user_permission_overrides
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
    id SERIAL,
    user_id INTEGER NOT NULL,
    module_id VARCHAR(100) NOT NULL,
    is_granted BOOLEAN NOT NULL,
    override_reason TEXT,
    overridden_by INTEGER,
    overridden_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT user_permission_overrides_pkey PRIMARY KEY (id),
    CONSTRAINT user_permission_overrides_user_id_module_id_key UNIQUE (user_id, module_id)
);

-- ============================================================================
-- VIEWS (DPA & HIPAA Anonymized Telemetry)
-- ============================================================================
CREATE OR REPLACE VIEW public.view_anonymized_patients AS
SELECT p.patient_id,
    concat('Subject #', p.patient_id, ' [', "substring"(md5(((COALESCE(p.name, 'Patient'::character varying))::text || (p.patient_id)::text)), 1, 8), ']') AS anonymous_subject_id,
    EXTRACT(year FROM age(now(), (p.birthdate)::timestamp with time zone)) AS age_years,
    (p.baseline_data ->> 'gender'::text) AS gender,
    COALESCE((p.baseline_data ->> 'condition'::text), 'Stable'::text) AS condition_status,
    p.facility_id,
    f.facility_name,
    ( SELECT count(*) AS count
           FROM sensor_readings sr
          WHERE (sr.patient_id = p.patient_id)) AS total_readings_count,
    ( SELECT count(*) AS count
           FROM anomaly_events ae
          WHERE (ae.patient_id = p.patient_id)) AS total_anomalies_count,
    ( SELECT json_build_object('heart_rate', sr.heart_rate, 'spo2', sr.spo2, 'temperature', sr.temperature, 'moisture', sr.moisture_value, 'recorded_at', sr.recorded_at) AS json_build_object
           FROM sensor_readings sr
          WHERE (sr.patient_id = p.patient_id)
          ORDER BY sr.recorded_at DESC
         LIMIT 1) AS latest_vitals,
    p.created_at
   FROM (patients p
     LEFT JOIN facilities f ON ((p.facility_id = f.facility_id)))
  WHERE (p.is_archived IS DISTINCT FROM true);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================
ALTER TABLE ONLY public.access_logs DROP CONSTRAINT IF EXISTS access_logs_target_patient_id_fkey;
ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_target_patient_id_fkey FOREIGN KEY (target_patient_id) REFERENCES public.patients(patient_id);
ALTER TABLE ONLY public.access_logs DROP CONSTRAINT IF EXISTS access_logs_user_id_fkey;
ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.alert_notifications DROP CONSTRAINT IF EXISTS alert_notifications_acknowledged_by_fkey;
ALTER TABLE ONLY public.alert_notifications
    ADD CONSTRAINT alert_notifications_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.alert_notifications DROP CONSTRAINT IF EXISTS alert_notifications_event_id_fkey;
ALTER TABLE ONLY public.alert_notifications
    ADD CONSTRAINT alert_notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.anomaly_events(event_id);
ALTER TABLE ONLY public.alert_notifications DROP CONSTRAINT IF EXISTS alert_notifications_user_id_fkey;
ALTER TABLE ONLY public.alert_notifications
    ADD CONSTRAINT alert_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.announcements DROP CONSTRAINT IF EXISTS announcements_created_by_fkey;
ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.anomaly_events DROP CONSTRAINT IF EXISTS anomaly_events_patient_id_fkey;
ALTER TABLE ONLY public.anomaly_events
    ADD CONSTRAINT anomaly_events_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.anomaly_events DROP CONSTRAINT IF EXISTS anomaly_events_reading_id_fkey;
ALTER TABLE ONLY public.anomaly_events
    ADD CONSTRAINT anomaly_events_reading_id_fkey FOREIGN KEY (reading_id) REFERENCES public.sensor_readings(reading_id);
ALTER TABLE ONLY public.archives DROP CONSTRAINT IF EXISTS fk_archived_by;
ALTER TABLE ONLY public.archives
    ADD CONSTRAINT fk_archived_by FOREIGN KEY (archived_by) REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.archives DROP CONSTRAINT IF EXISTS fk_facility;
ALTER TABLE ONLY public.archives
    ADD CONSTRAINT fk_facility FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.care_logs DROP CONSTRAINT IF EXISTS care_logs_author_id_fkey;
ALTER TABLE ONLY public.care_logs
    ADD CONSTRAINT care_logs_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.care_logs DROP CONSTRAINT IF EXISTS care_logs_patient_id_fkey;
ALTER TABLE ONLY public.care_logs
    ADD CONSTRAINT care_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.device_whitelist DROP CONSTRAINT IF EXISTS device_whitelist_added_by_fkey;
ALTER TABLE ONLY public.device_whitelist
    ADD CONSTRAINT device_whitelist_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.device_whitelist DROP CONSTRAINT IF EXISTS device_whitelist_assigned_patient_id_fkey;
ALTER TABLE ONLY public.device_whitelist
    ADD CONSTRAINT device_whitelist_assigned_patient_id_fkey FOREIGN KEY (assigned_patient_id) REFERENCES public.patients(patient_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.hardware_system_alerts DROP CONSTRAINT IF EXISTS hardware_system_alerts_patient_id_fkey;
ALTER TABLE ONLY public.hardware_system_alerts
    ADD CONSTRAINT hardware_system_alerts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hardware_system_alerts DROP CONSTRAINT IF EXISTS hardware_system_alerts_resolved_by_fkey;
ALTER TABLE ONLY public.hardware_system_alerts
    ADD CONSTRAINT hardware_system_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.ip_blacklist DROP CONSTRAINT IF EXISTS ip_blacklist_banned_by_fkey;
ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.legal_documents DROP CONSTRAINT IF EXISTS legal_documents_created_by_fkey;
ALTER TABLE ONLY public.legal_documents
    ADD CONSTRAINT legal_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.patient_access DROP CONSTRAINT IF EXISTS patient_access_patient_id_fkey;
ALTER TABLE ONLY public.patient_access
    ADD CONSTRAINT patient_access_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.patient_access DROP CONSTRAINT IF EXISTS patient_access_user_id_fkey;
ALTER TABLE ONLY public.patient_access
    ADD CONSTRAINT patient_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.patient_baselines DROP CONSTRAINT IF EXISTS patient_baselines_patient_id_fkey;
ALTER TABLE ONLY public.patient_baselines
    ADD CONSTRAINT patient_baselines_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.patients DROP CONSTRAINT IF EXISTS patients_facility_id_fkey;
ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id);
ALTER TABLE ONLY public.profiles_caregivers DROP CONSTRAINT IF EXISTS profiles_caregivers_user_id_fkey;
ALTER TABLE ONLY public.profiles_caregivers
    ADD CONSTRAINT profiles_caregivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.profiles_medical_staff DROP CONSTRAINT IF EXISTS profiles_medical_staff_user_id_fkey;
ALTER TABLE ONLY public.profiles_medical_staff
    ADD CONSTRAINT profiles_medical_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reports DROP CONSTRAINT IF EXISTS reports_patient_id_fkey;
ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);
ALTER TABLE ONLY public.reports DROP CONSTRAINT IF EXISTS reports_user_id_fkey;
ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.role_permissions DROP CONSTRAINT IF EXISTS fk_role_permissions_module;
ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT fk_role_permissions_module FOREIGN KEY (module_id) REFERENCES public.system_modules(module_id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE ONLY public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_updated_by_fkey;
ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.sensor_readings DROP CONSTRAINT IF EXISTS sensor_readings_patient_id_fkey;
ALTER TABLE ONLY public.sensor_readings
    ADD CONSTRAINT sensor_readings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.session_revocations DROP CONSTRAINT IF EXISTS session_revocations_revoked_by_fkey;
ALTER TABLE ONLY public.session_revocations
    ADD CONSTRAINT session_revocations_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.session_revocations DROP CONSTRAINT IF EXISTS session_revocations_user_id_fkey;
ALTER TABLE ONLY public.session_revocations
    ADD CONSTRAINT session_revocations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.system_configs DROP CONSTRAINT IF EXISTS system_configs_updated_by_fkey;
ALTER TABLE ONLY public.system_configs
    ADD CONSTRAINT system_configs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.user_documents DROP CONSTRAINT IF EXISTS user_documents_reviewed_by_fkey;
ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.user_documents DROP CONSTRAINT IF EXISTS user_documents_user_id_fkey;
ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_email_otps DROP CONSTRAINT IF EXISTS fk_user_otp;
ALTER TABLE ONLY public.user_email_otps
    ADD CONSTRAINT fk_user_otp FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_firmware_downloads DROP CONSTRAINT IF EXISTS user_firmware_downloads_user_id_fkey;
ALTER TABLE ONLY public.user_firmware_downloads
    ADD CONSTRAINT user_firmware_downloads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_permission_overrides DROP CONSTRAINT IF EXISTS user_permission_overrides_overridden_by_fkey;
ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_overridden_by_fkey FOREIGN KEY (overridden_by) REFERENCES public.users(user_id);
ALTER TABLE ONLY public.user_permission_overrides DROP CONSTRAINT IF EXISTS user_permission_overrides_user_id_fkey;
ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;
ALTER TABLE ONLY public.users DROP CONSTRAINT IF EXISTS users_created_by_fkey;
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE SET NULL;
ALTER TABLE ONLY public.users DROP CONSTRAINT IF EXISTS users_facility_id_fkey;
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_device_patient ON public.device_whitelist USING btree (assigned_patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_baselines_patient_id ON public.patient_baselines USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_system_reports_archived ON public.system_reports USING btree (is_archived);
CREATE INDEX IF NOT EXISTS idx_system_reports_category ON public.system_reports USING btree (category);
CREATE INDEX IF NOT EXISTS idx_system_reports_created ON public.system_reports USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_reports_type ON public.system_reports USING btree (report_type);

-- ============================================================================
-- COMPLIANCE & SECURITY COMMENTS (OWASP, HIPAA, DPA, AI Baselines)
-- ============================================================================
COMMENT ON TABLE public.patient_baselines IS 'Stores the personalized adaptive baseline for the OC-SVM anomaly suppression layer. Each row tracks one vital sign per patient.';
COMMENT ON COLUMN public.patient_baselines.flagged_values IS 'JSONB array of numeric readings the caregiver has flagged as normal. Used to compute mean/bounds after 5 flags.';
COMMENT ON COLUMN public.patients.is_monitoring_disabled IS 'When TRUE, sensor telemetry ingestion and alert generation are disabled for this patient.';
COMMENT ON COLUMN public.device_whitelist.device_token_hash IS '[OWASP A07] SHA-256 hash of the device-specific API token.';
COMMENT ON TABLE public.access_logs IS '[OWASP A09 / DPA / HIPAA] Tamper-evident system access audit log.';
