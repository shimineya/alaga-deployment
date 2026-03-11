const pool = require('./db');

async function createTables() {
    try {
        console.log("Checking tables...");

        // 1. Device Whitelist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS device_whitelist (
                device_id SERIAL PRIMARY KEY,
                mac_address VARCHAR(50) UNIQUE NOT NULL,
                device_name VARCHAR(100),
                added_by INTEGER REFERENCES users(user_id),
                status VARCHAR(20) DEFAULT 'ACTIVE',
                assigned_patient_id INTEGER REFERENCES patients(patient_id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Table 'device_whitelist' verified.");

        // 2. Ensure patients table exists (from schema, but double check)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS patients (
                patient_id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                birthdate DATE NOT NULL,
                baseline_data JSONB,
                is_archived BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Table 'patients' verified.");

        // 3. Ensure patient_access table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS patient_access (
                access_id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(user_id),
                patient_id INTEGER REFERENCES patients(patient_id),
                relationship VARCHAR(50),
                access_level VARCHAR(20) DEFAULT 'View',
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Table 'patient_access' verified.");

        process.exit(0);
    } catch (err) {
        console.error("❌ Migration Error:", err);
        process.exit(1);
    }
}

createTables();
