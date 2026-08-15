BEGIN;

-- Ensure profile routes can read/write profile picture path.
ALTER TABLE IF EXISTS public.users
    ADD COLUMN IF NOT EXISTS profile_picture_url character varying(255);

-- Caregiver routes update patients.updated_at during edit/archive.
ALTER TABLE IF EXISTS public.patients
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;

-- Alerts routes expect richer clinical alert metadata.
ALTER TABLE IF EXISTS public.alert_notifications
    ADD COLUMN IF NOT EXISTS alert_category character varying(50),
    ADD COLUMN IF NOT EXISTS acknowledged_by integer,
    ADD COLUMN IF NOT EXISTS acknowledged_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS action_taken text,
    ADD COLUMN IF NOT EXISTS resolution_notes text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'alert_notifications_acknowledged_by_fkey'
    ) THEN
        ALTER TABLE public.alert_notifications
            ADD CONSTRAINT alert_notifications_acknowledged_by_fkey
            FOREIGN KEY (acknowledged_by)
            REFERENCES public.users (user_id)
            ON UPDATE NO ACTION
            ON DELETE SET NULL;
    END IF;
END $$;

-- Break-glass route writes JSON details into access_logs.
ALTER TABLE IF EXISTS public.access_logs
    ADD COLUMN IF NOT EXISTS details jsonb;

-- System alerts endpoints depend on this table.
CREATE TABLE IF NOT EXISTS public.hardware_system_alerts
(
    sys_alert_id serial PRIMARY KEY,
    patient_id integer,
    alert_type character varying(100) NOT NULL,
    severity character varying(20) DEFAULT 'INFO',
    description text,
    triggered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'Open',
    resolved_by integer,
    resolved_at timestamp with time zone,
    resolution_notes text
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'hardware_system_alerts_patient_id_fkey'
    ) THEN
        ALTER TABLE public.hardware_system_alerts
            ADD CONSTRAINT hardware_system_alerts_patient_id_fkey
            FOREIGN KEY (patient_id)
            REFERENCES public.patients (patient_id)
            ON UPDATE NO ACTION
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'hardware_system_alerts_resolved_by_fkey'
    ) THEN
        ALTER TABLE public.hardware_system_alerts
            ADD CONSTRAINT hardware_system_alerts_resolved_by_fkey
            FOREIGN KEY (resolved_by)
            REFERENCES public.users (user_id)
            ON UPDATE NO ACTION
            ON DELETE SET NULL;
    END IF;
END $$;

COMMIT;
