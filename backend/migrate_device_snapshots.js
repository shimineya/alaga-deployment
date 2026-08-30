const pool = require('./db');

async function migrate() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS device_snapshots (
                snapshot_id SERIAL PRIMARY KEY,
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
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_archived BOOLEAN DEFAULT FALSE
            );
            ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
            ALTER TABLE device_whitelist ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
        `);
        console.log('✅ Device snapshots migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit(0);
    }
}

migrate();
