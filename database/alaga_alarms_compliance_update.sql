-- ==============================================================================
-- ALAGA SYSTEM: Alerts & Compliance Schema Update (OWASP & HIPAA Aligned)
-- Author: Assistant
-- Description: Enhances the existing Alaga database schema (Updated Schema.sql) to
--              support HIPAA-compliant audit trails, structured alert triage, 
--              and IoT Hardware/System state tracking.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. [HIPAA] Non-Repudiation for Clinical Alerts
-- Modifying the existing `alert_notifications` to require an audit trail of 
-- who responded to the alert and what action was taken.
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.alert_notifications
    -- Categorization & Prioritization
    ADD COLUMN IF NOT EXISTS alert_category character varying(50) DEFAULT 'Clinical', -- 'Clinical', 'System', 'Security'
    ADD COLUMN IF NOT EXISTS severity character varying(20) DEFAULT 'Info',           -- 'Critical', 'Warning', 'Info'
    
    -- HIPAA Audit Fields
    ADD COLUMN IF NOT EXISTS acknowledged_by integer,
    ADD COLUMN IF NOT EXISTS acknowledged_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS action_taken character varying(255),
    ADD COLUMN IF NOT EXISTS resolution_notes text;

-- Add Foreign Key for the acknowledging user
ALTER TABLE IF EXISTS public.alert_notifications
    DROP CONSTRAINT IF EXISTS alert_notifications_acknowledged_by_fkey,
    ADD CONSTRAINT alert_notifications_acknowledged_by_fkey FOREIGN KEY (acknowledged_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


-- ------------------------------------------------------------------------------
-- 2. IoT System & Hardware Health Tracking
-- Dedicated table to track device issues separate from patient clinical data.
-- Prevents caregiver confusion between "vitals normal" and "sensor broken".
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hardware_system_alerts
(
    sys_alert_id serial NOT NULL,
    patient_id integer,
    device_mac_address character varying(50) COLLATE pg_catalog."default",
    alert_type character varying(100) COLLATE pg_catalog."default" NOT NULL, -- e.g., 'Low Battery', 'Sensor Disconnected'
    severity character varying(20) COLLATE pg_catalog."default" DEFAULT 'Warning'::character varying,
    description text COLLATE pg_catalog."default",
    triggered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    
    -- Resolution Tracking
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'Active'::character varying, -- 'Active', 'Resolved'
    resolved_by integer,
    resolved_at timestamp with time zone,
    resolution_notes text COLLATE pg_catalog."default",
    
    CONSTRAINT hardware_system_alerts_pkey PRIMARY KEY (sys_alert_id),
    CONSTRAINT hardware_system_alerts_patient_id_fkey FOREIGN KEY (patient_id)
        REFERENCES public.patients (patient_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT hardware_system_alerts_resolved_by_fkey FOREIGN KEY (resolved_by)
        REFERENCES public.users (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
);


-- ------------------------------------------------------------------------------
-- 3. [OWASP A09] Security & Access Logging Enhancements
-- Expanding the existing access_logs table to detect brute force attempts and
-- unauthorized IP activity.
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.access_logs
    ADD COLUMN IF NOT EXISTS ip_address character varying(45) COLLATE pg_catalog."default", -- Supports IPv6
    ADD COLUMN IF NOT EXISTS user_agent text COLLATE pg_catalog."default",
    ADD COLUMN IF NOT EXISTS status character varying(20) COLLATE pg_catalog."default" DEFAULT 'Success'::character varying; -- 'Success', 'Failed', 'Blocked'

COMMIT;
