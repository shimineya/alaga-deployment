SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.access_logs (
    log_id bigint NOT NULL,
    user_id integer,
    target_patient_id integer,
    action character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    ip_address inet,
    user_agent text,
    resource_affected character varying(100),
    severity character varying(20) DEFAULT 'INFO'::character varying,
    status character varying(20) DEFAULT 'SUCCESS'::character varying
);

CREATE SEQUENCE public.access_logs_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.access_logs_log_id_seq OWNED BY public.access_logs.log_id;

CREATE TABLE public.alert_notifications (
    alert_id integer NOT NULL,
    event_id integer,
    user_id integer,
    status character varying(20) DEFAULT 'Sent'::character varying,
    message text,
    sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    severity character varying(20) DEFAULT 'INFO'::character varying
);

CREATE SEQUENCE public.alert_notifications_alert_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.alert_notifications_alert_id_seq OWNED BY public.alert_notifications.alert_id;

CREATE TABLE public.announcements (
    id integer NOT NULL,
    title character varying(100) NOT NULL,
    message text NOT NULL,
    is_active boolean DEFAULT true,
    created_by integer,
    created_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;

CREATE TABLE public.anomaly_events (
    event_id integer NOT NULL,
    patient_id integer,
    reading_id bigint,
    anomaly_type character varying(50),
    ocsvm_score numeric(10,4),
    detected_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.anomaly_events_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.anomaly_events_event_id_seq OWNED BY public.anomaly_events.event_id;

CREATE TABLE public.device_whitelist (
    serial_number character varying(50) NOT NULL,
    device_name character varying(50),
    firmware_version character varying(20),
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    added_by integer,
    created_at timestamp with time zone DEFAULT now(),
    last_heartbeat timestamp with time zone,
    assigned_patient_id integer,
    last_serviced_at timestamp with time zone DEFAULT now(),
    device_token_hash character varying(255)
);

CREATE TABLE public.facilities (
    facility_id integer NOT NULL,
    facility_name character varying(255) NOT NULL,
    address text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE public.facilities_facility_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.facilities_facility_id_seq OWNED BY public.facilities.facility_id;

CREATE TABLE public.hardware_system_alerts (
    sys_alert_id integer NOT NULL,
    patient_id integer,
    device_mac_address character varying(50),
    alert_type character varying(100) NOT NULL,
    severity character varying(20) DEFAULT 'Warning'::character varying,
    description text,
    triggered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'Active'::character varying,
    resolved_by integer,
    resolved_at timestamp with time zone,
    resolution_notes text
);

CREATE SEQUENCE public.hardware_system_alerts_sys_alert_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.hardware_system_alerts_sys_alert_id_seq OWNED BY public.hardware_system_alerts.sys_alert_id;

CREATE TABLE public.ip_blacklist (
    id integer NOT NULL,
    ip_address character varying(45) NOT NULL,
    reason text,
    banned_by integer,
    banned_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE public.ip_blacklist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.ip_blacklist_id_seq OWNED BY public.ip_blacklist.id;

CREATE TABLE public.legal_documents (
    doc_id integer NOT NULL,
    doc_type character varying(50),
    title character varying(255) NOT NULL,
    content text NOT NULL,
    version character varying(20) NOT NULL,
    is_active boolean DEFAULT false,
    created_by integer,
    published_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE public.legal_documents_doc_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.legal_documents_doc_id_seq OWNED BY public.legal_documents.doc_id;

CREATE TABLE public.patient_access (
    access_id integer NOT NULL,
    user_id integer,
    patient_id integer,
    relationship character varying(50),
    access_level character varying(20) DEFAULT 'View'::character varying,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.patient_access_access_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.patient_access_access_id_seq OWNED BY public.patient_access.access_id;

CREATE TABLE public.patients (
    patient_id integer NOT NULL,
    name character varying(100) NOT NULL,
    birthdate date NOT NULL,
    patient_type character varying(50),
    device_serial_number character varying(50),
    baseline_data jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_archived boolean DEFAULT false,
    facility_id integer
);

CREATE SEQUENCE public.patients_patient_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.patients_patient_id_seq OWNED BY public.patients.patient_id;

CREATE TABLE public.profiles_caregivers (
    profile_id integer NOT NULL,
    user_id integer,
    caregiver_type character varying(50),
    certifications text[],
    years_experience integer,
    agency_name character varying(150),
    emergency_contact character varying(50),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    work_shift character varying(50),
    notification_preferences text[]
);

CREATE SEQUENCE public.profiles_caregivers_profile_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.profiles_caregivers_profile_id_seq OWNED BY public.profiles_caregivers.profile_id;

CREATE TABLE public.profiles_medical_staff (
    profile_id integer NOT NULL,
    user_id integer,
    license_number character varying(50) NOT NULL,
    specialization character varying(100),
    hospital_affiliation character varying(150),
    years_of_practice integer,
    schedule_availability jsonb,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    practice_type character varying(50),
    is_solo_practitioner boolean DEFAULT false
);

CREATE SEQUENCE public.profiles_medical_staff_profile_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.profiles_medical_staff_profile_id_seq OWNED BY public.profiles_medical_staff.profile_id;

CREATE TABLE public.reports (
    report_id integer NOT NULL,
    user_id integer,
    patient_id integer,
    report_type character varying(50),
    file_url character varying(255),
    generated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.reports_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.reports_report_id_seq OWNED BY public.reports.report_id;

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role character varying(50) NOT NULL,
    module_id character varying(100) NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    updated_by integer,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;

CREATE TABLE public.schedules (
    schedule_id integer NOT NULL,
    patient_name character varying(255) NOT NULL,
    event_type character varying(100) NOT NULL,
    custom_event_name text,
    is_recurring boolean DEFAULT false,
    recurrence_interval character varying(50),
    scheduled_at timestamp without time zone NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.schedules_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.schedules_schedule_id_seq OWNED BY public.schedules.schedule_id;

CREATE TABLE public.sensor_readings (
    reading_id bigint NOT NULL,
    patient_id integer,
    heart_rate integer,
    spo2 integer,
    temperature numeric(5,2),
    moisture_value integer,
    recorded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.sensor_readings_reading_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sensor_readings_reading_id_seq OWNED BY public.sensor_readings.reading_id;

CREATE TABLE public.session_revocations (
    user_id integer NOT NULL,
    revoked_before timestamp with time zone DEFAULT now() NOT NULL,
    revoked_by integer,
    reason text
);

CREATE TABLE public.system_configs (
    config_key character varying(50) NOT NULL,
    config_value jsonb NOT NULL,
    description text,
    updated_by integer,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.system_modules (
    module_id character varying(100) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    category character varying(50) NOT NULL
);

CREATE TABLE public.user_documents (
    document_id integer NOT NULL,
    user_id integer,
    document_type character varying(50) NOT NULL,
    file_url character varying(255) NOT NULL,
    upload_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    verification_status character varying(20) DEFAULT 'Pending'::character varying,
    reviewed_by integer,
    rejection_reason text
);

CREATE SEQUENCE public.user_documents_document_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_documents_document_id_seq OWNED BY public.user_documents.document_id;

CREATE TABLE public.user_email_otps (
    otp_id integer NOT NULL,
    user_id integer NOT NULL,
    email character varying(255) NOT NULL,
    otp_code character varying(6),
    expires_at timestamp without time zone NOT NULL,
    is_verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    purpose character varying(50) DEFAULT 'REGISTRATION'::character varying,
    consumed_at timestamp with time zone,
    otp_hash character varying(255),
    last_sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    attempts_count integer DEFAULT 0
);

CREATE SEQUENCE public.user_email_otps_otp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_email_otps_otp_id_seq OWNED BY public.user_email_otps.otp_id;

CREATE TABLE public.user_permission_overrides (
    id integer NOT NULL,
    user_id integer NOT NULL,
    module_id character varying(100) NOT NULL,
    is_granted boolean NOT NULL,
    override_reason text,
    overridden_by integer,
    overridden_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE public.user_permission_overrides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_permission_overrides_id_seq OWNED BY public.user_permission_overrides.id;

CREATE TABLE public.users (
    user_id integer NOT NULL,
    username character varying(50),
    password_hash character varying(255) NOT NULL,
    email character varying(100) NOT NULL,
    first_name character varying(50),
    last_name character varying(50),
    role character varying(20) NOT NULL,
    is_biometric_enabled boolean DEFAULT false,
    is_mfa_enabled boolean DEFAULT false,
    mfa_secret character varying(255),
    mfa_method character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_verified boolean DEFAULT false,
    account_status character varying(20) DEFAULT 'Pending_Review'::character varying,
    mobile_number character varying(20),
    middle_initial character varying(5),
    is_locked boolean DEFAULT false,
    failed_login_attempts integer DEFAULT 0,
    force_logout_at timestamp with time zone,
    facility_id integer,
    last_activity_at timestamp with time zone,
    profile_picture_url character varying(255)
);

CREATE SEQUENCE public.users_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;

ALTER TABLE ONLY public.access_logs ALTER COLUMN log_id SET DEFAULT nextval('public.access_logs_log_id_seq'::regclass);

ALTER TABLE ONLY public.alert_notifications ALTER COLUMN alert_id SET DEFAULT nextval('public.alert_notifications_alert_id_seq'::regclass);

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);

ALTER TABLE ONLY public.anomaly_events ALTER COLUMN event_id SET DEFAULT nextval('public.anomaly_events_event_id_seq'::regclass);

ALTER TABLE ONLY public.facilities ALTER COLUMN facility_id SET DEFAULT nextval('public.facilities_facility_id_seq'::regclass);

ALTER TABLE ONLY public.hardware_system_alerts ALTER COLUMN sys_alert_id SET DEFAULT nextval('public.hardware_system_alerts_sys_alert_id_seq'::regclass);

ALTER TABLE ONLY public.ip_blacklist ALTER COLUMN id SET DEFAULT nextval('public.ip_blacklist_id_seq'::regclass);

ALTER TABLE ONLY public.legal_documents ALTER COLUMN doc_id SET DEFAULT nextval('public.legal_documents_doc_id_seq'::regclass);

ALTER TABLE ONLY public.patient_access ALTER COLUMN access_id SET DEFAULT nextval('public.patient_access_access_id_seq'::regclass);

ALTER TABLE ONLY public.patients ALTER COLUMN patient_id SET DEFAULT nextval('public.patients_patient_id_seq'::regclass);

ALTER TABLE ONLY public.profiles_caregivers ALTER COLUMN profile_id SET DEFAULT nextval('public.profiles_caregivers_profile_id_seq'::regclass);

ALTER TABLE ONLY public.profiles_medical_staff ALTER COLUMN profile_id SET DEFAULT nextval('public.profiles_medical_staff_profile_id_seq'::regclass);

ALTER TABLE ONLY public.reports ALTER COLUMN report_id SET DEFAULT nextval('public.reports_report_id_seq'::regclass);

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);

ALTER TABLE ONLY public.schedules ALTER COLUMN schedule_id SET DEFAULT nextval('public.schedules_schedule_id_seq'::regclass);

ALTER TABLE ONLY public.sensor_readings ALTER COLUMN reading_id SET DEFAULT nextval('public.sensor_readings_reading_id_seq'::regclass);

ALTER TABLE ONLY public.user_documents ALTER COLUMN document_id SET DEFAULT nextval('public.user_documents_document_id_seq'::regclass);

ALTER TABLE ONLY public.user_email_otps ALTER COLUMN otp_id SET DEFAULT nextval('public.user_email_otps_otp_id_seq'::regclass);

ALTER TABLE ONLY public.user_permission_overrides ALTER COLUMN id SET DEFAULT nextval('public.user_permission_overrides_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_pkey PRIMARY KEY (log_id);

ALTER TABLE ONLY public.alert_notifications
    ADD CONSTRAINT alert_notifications_pkey PRIMARY KEY (alert_id);

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.anomaly_events
    ADD CONSTRAINT anomaly_events_pkey PRIMARY KEY (event_id);

ALTER TABLE ONLY public.device_whitelist
    ADD CONSTRAINT device_whitelist_pkey PRIMARY KEY (serial_number);

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (facility_id);

ALTER TABLE ONLY public.hardware_system_alerts
    ADD CONSTRAINT hardware_system_alerts_pkey PRIMARY KEY (sys_alert_id);

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_ip_address_key UNIQUE (ip_address);

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.legal_documents
    ADD CONSTRAINT legal_documents_pkey PRIMARY KEY (doc_id);

ALTER TABLE ONLY public.patient_access
    ADD CONSTRAINT patient_access_pkey PRIMARY KEY (access_id);

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_device_mac_address_key UNIQUE (device_serial_number);

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (patient_id);

ALTER TABLE ONLY public.profiles_caregivers
    ADD CONSTRAINT profiles_caregivers_pkey PRIMARY KEY (profile_id);

ALTER TABLE ONLY public.profiles_caregivers
    ADD CONSTRAINT profiles_caregivers_user_id_key UNIQUE (user_id);

ALTER TABLE ONLY public.profiles_medical_staff
    ADD CONSTRAINT profiles_medical_staff_license_number_key UNIQUE (license_number);

ALTER TABLE ONLY public.profiles_medical_staff
    ADD CONSTRAINT profiles_medical_staff_pkey PRIMARY KEY (profile_id);

ALTER TABLE ONLY public.profiles_medical_staff
    ADD CONSTRAINT profiles_medical_staff_user_id_key UNIQUE (user_id);

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (report_id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_module_id_key UNIQUE (role, module_id);

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (schedule_id);

ALTER TABLE ONLY public.sensor_readings
    ADD CONSTRAINT sensor_readings_pkey PRIMARY KEY (reading_id);

ALTER TABLE ONLY public.session_revocations
    ADD CONSTRAINT session_revocations_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.system_configs
    ADD CONSTRAINT system_configs_pkey PRIMARY KEY (config_key);

ALTER TABLE ONLY public.system_modules
    ADD CONSTRAINT system_modules_pkey PRIMARY KEY (module_id);

ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_pkey PRIMARY KEY (document_id);

ALTER TABLE ONLY public.user_email_otps
    ADD CONSTRAINT user_email_otps_pkey PRIMARY KEY (otp_id);

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_user_id_module_id_key UNIQUE (user_id, module_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);

CREATE INDEX idx_device_patient ON public.device_whitelist USING btree (assigned_patient_id);

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_target_patient_id_fkey FOREIGN KEY (target_patient_id) REFERENCES public.patients(patient_id);

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.alert_notifications
    ADD CONSTRAINT alert_notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.anomaly_events(event_id);

ALTER TABLE ONLY public.alert_notifications
    ADD CONSTRAINT alert_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.anomaly_events
    ADD CONSTRAINT anomaly_events_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.anomaly_events
    ADD CONSTRAINT anomaly_events_reading_id_fkey FOREIGN KEY (reading_id) REFERENCES public.sensor_readings(reading_id);

ALTER TABLE ONLY public.device_whitelist
    ADD CONSTRAINT device_whitelist_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.device_whitelist
    ADD CONSTRAINT device_whitelist_assigned_patient_id_fkey FOREIGN KEY (assigned_patient_id) REFERENCES public.patients(patient_id) ON DELETE SET NULL;

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT fk_role_permissions_module FOREIGN KEY (module_id) REFERENCES public.system_modules(module_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.user_email_otps
    ADD CONSTRAINT fk_user_otp FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.hardware_system_alerts
    ADD CONSTRAINT hardware_system_alerts_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.hardware_system_alerts
    ADD CONSTRAINT hardware_system_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.ip_blacklist
    ADD CONSTRAINT ip_blacklist_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.legal_documents
    ADD CONSTRAINT legal_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.patient_access
    ADD CONSTRAINT patient_access_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.patient_access
    ADD CONSTRAINT patient_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id);

ALTER TABLE ONLY public.profiles_caregivers
    ADD CONSTRAINT profiles_caregivers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles_medical_staff
    ADD CONSTRAINT profiles_medical_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id);

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.sensor_readings
    ADD CONSTRAINT sensor_readings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session_revocations
    ADD CONSTRAINT session_revocations_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.session_revocations
    ADD CONSTRAINT session_revocations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.system_configs
    ADD CONSTRAINT system_configs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_overridden_by_fkey FOREIGN KEY (overridden_by) REFERENCES public.users(user_id);

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id);