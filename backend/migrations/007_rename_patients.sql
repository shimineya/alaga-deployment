-- =============================================================================
-- ALAGA SYSTEM — NeonDB Patient Name Migration Script
-- Purpose : Globally rename test/placeholder patient names across all tables
--           (patients, schedules, alert_notifications, hardware_system_alerts,
--            care_logs, archives, device_snapshots, reports, access_logs).
-- Usage   : Paste into the Neon SQL Editor (or run via psql) and execute.
--           You can customize the 4 "new_name" values in the mapping table below.
-- =============================================================================

BEGIN;

DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Define Old Name -> New Name mapping here:
    FOR rec IN
        SELECT * FROM (VALUES
            ('Cynthia Villar', 'Elena Santos'),
            ('Manny Bilyar',   'Roberto Cruz'),
            ('Camille Viller', 'Sofia Reyes'),
            ('Jojo Beenye',    'Antonio Mendoza')
        ) AS t(old_name, new_name)
    LOOP
        -- 1. Primary Patients Table (exact & case-insensitive match)
        UPDATE patients
        SET name = rec.new_name,
            updated_at = NOW()
        WHERE LOWER(TRIM(name)) = LOWER(rec.old_name);

        -- Also update first_name / last_name columns if present in schema
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'patients' AND column_name = 'first_name'
        ) THEN
            EXECUTE format(
                'UPDATE patients SET first_name = $1, last_name = $2 WHERE LOWER(TRIM(name)) = LOWER($3)'
            ) USING split_part(rec.new_name, ' ', 1),
                    substr(rec.new_name, strpos(rec.new_name, ' ') + 1),
                    rec.new_name;
        END IF;

        -- 2. Schedules Table (linked by patient_name)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'schedules' AND column_name = 'patient_name'
        ) THEN
            UPDATE schedules
            SET patient_name = rec.new_name
            WHERE LOWER(TRIM(patient_name)) = LOWER(rec.old_name);
        END IF;

        -- 3. Alert Notifications (replace occurrences inside alert message text)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'alert_notifications' AND column_name = 'message'
        ) THEN
            UPDATE alert_notifications
            SET message = regexp_replace(message, rec.old_name, rec.new_name, 'gi')
            WHERE message ILIKE '%' || rec.old_name || '%';
        END IF;

        -- 4. Hardware System Alerts (replace occurrences inside description)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'hardware_system_alerts' AND column_name = 'description'
        ) THEN
            UPDATE hardware_system_alerts
            SET description = regexp_replace(description, rec.old_name, rec.new_name, 'gi')
            WHERE description ILIKE '%' || rec.old_name || '%';
        END IF;

        -- 5. Care Logs (replace occurrences inside clinical log content)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'care_logs' AND column_name = 'content'
        ) THEN
            UPDATE care_logs
            SET content = regexp_replace(content, rec.old_name, rec.new_name, 'gi')
            WHERE content ILIKE '%' || rec.old_name || '%';
        END IF;

        -- 6. Archives Table (target_name for archived patients / alerts / devices)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'archives' AND column_name = 'target_name'
        ) THEN
            UPDATE archives
            SET target_name = regexp_replace(target_name, rec.old_name, rec.new_name, 'gi')
            WHERE target_name ILIKE '%' || rec.old_name || '%';
        END IF;

        -- 7. Device Snapshots (assigned_patient_name & snapshot_data JSONB)
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'device_snapshots'
        ) THEN
            UPDATE device_snapshots
            SET assigned_patient_name = rec.new_name
            WHERE LOWER(TRIM(assigned_patient_name)) = LOWER(rec.old_name);

            UPDATE device_snapshots
            SET snapshot_data = regexp_replace(snapshot_data::text, rec.old_name, rec.new_name, 'gi')::jsonb
            WHERE snapshot_data::text ILIKE '%' || rec.old_name || '%';
        END IF;

        -- 8. Reports Table (title, description, or JSONB report payloads)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'reports' AND column_name = 'title'
        ) THEN
            UPDATE reports
            SET title = regexp_replace(title, rec.old_name, rec.new_name, 'gi')
            WHERE title ILIKE '%' || rec.old_name || '%';
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'reports' AND column_name = 'description'
        ) THEN
            UPDATE reports
            SET description = regexp_replace(description, rec.old_name, rec.new_name, 'gi')
            WHERE description ILIKE '%' || rec.old_name || '%';
        END IF;
    END LOOP;
END $$;

COMMIT;

-- Verify updated patient records:
SELECT patient_id, name, patient_type, device_serial_number, is_archived
FROM patients
ORDER BY patient_id;

