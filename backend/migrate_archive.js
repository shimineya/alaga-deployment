const pool = require('./db');

async function migrateArchive() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log("Creating archives table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.archives (
                archive_id SERIAL PRIMARY KEY,
                entity_type character varying(50) NOT NULL,
                target_id character varying(100) NOT NULL,
                target_name character varying(255) NOT NULL,
                archived_by integer,
                archived_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
                status character varying(20) DEFAULT 'Archived',
                facility_id integer,
                CONSTRAINT fk_archived_by FOREIGN KEY (archived_by) REFERENCES public.users(user_id) ON DELETE SET NULL,
                CONSTRAINT fk_facility FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id) ON DELETE SET NULL
            );
        `);
        console.log("Archives table created successfully.");

        console.log("Adding is_archived column to schedules if not exists...");
        await client.query(`
            ALTER TABLE schedules ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
        `);

        console.log("Adding is_archived column to announcements if not exists...");
        await client.query(`
            ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
        `);

        console.log("Backfilling historical archived patients...");
        await client.query(`
            INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
            SELECT 'Patient', patient_id::varchar, name, NULL, COALESCE(updated_at, created_at, NOW()), 'Archived', facility_id
            FROM patients
            WHERE is_archived = true
            AND NOT EXISTS (
                SELECT 1 FROM archives WHERE entity_type = 'Patient' AND target_id = patients.patient_id::varchar
            );
        `);

        console.log("Backfilling historical archived users...");
        await client.query(`
            INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
            SELECT 'User', user_id::varchar, COALESCE(username, email), created_by, created_at, 'Archived', facility_id
            FROM users
            WHERE is_archived = true
            AND NOT EXISTS (
                SELECT 1 FROM archives WHERE entity_type = 'User' AND target_id = users.user_id::varchar
            );
        `);

        console.log("Backfilling historical archived devices...");
        await client.query(`
            INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
            SELECT 'Device', serial_number, COALESCE(device_name, serial_number), added_by, created_at, 'Archived', NULL
            FROM device_whitelist
            WHERE is_archived = true
            AND NOT EXISTS (
                SELECT 1 FROM archives WHERE entity_type = 'Device' AND target_id = device_whitelist.serial_number
            );
        `);

        console.log("Backfilling historical archived facilities...");
        await client.query(`
            INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
            SELECT 'Facility', facility_id::varchar, facility_name, NULL, created_at, 'Archived', facility_id
            FROM facilities
            WHERE is_archived = true
            AND NOT EXISTS (
                SELECT 1 FROM archives WHERE entity_type = 'Facility' AND target_id = facilities.facility_id::varchar
            );
        `);

        await client.query('COMMIT');
        console.log("Migration and backfilling finished successfully.");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Migration Error:", err);
    } finally {
        client.release();
        pool.end();
    }
}

migrateArchive();
