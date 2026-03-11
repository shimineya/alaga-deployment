const pool = require('./db');

async function fixSchema() {
    try {
        console.log("--- Fixing Database Schema ---");

        // 1. We need to drop the constraint first because it relies on the column type? 
        // Actually, changing type from macaddr to varchar might require a cast.

        // Let's check dependencies first.
        // device_whitelist.mac_address is a PRIMARY KEY.
        // It is referenced by patients(device_mac_address) ?? No, constraints say:
        // patients has UNIQUE(device_mac_address).
        // device_whitelist has PRIMARY KEY (mac_address).

        // Wait, look at constraints:
        // ALTER TABLE IF EXISTS public.device_whitelist ADD CONSTRAINT device_whitelist_assigned_patient_id_fkey ...
        // No foreign key from patients TO device_whitelist on mac_address? 
        // Let's check if any other table references device_whitelist.mac_address using FK.
        // The user provided schema shows NO foreign keys pointing TO device_whitelist.mac_address.

        // However, changing a Primary Key type is tricky.

        console.log("Altering mac_address to VARCHAR(50)...");

        // Determine the command based on current state.
        // Using '::text' or '::varchar' for casting if there is existing data.

        await pool.query(`
            ALTER TABLE device_whitelist 
            ALTER COLUMN mac_address TYPE VARCHAR(50) USING mac_address::VARCHAR;
        `);

        console.log("✅ Successfully changed mac_address to VARCHAR(50).");
        process.exit(0);

    } catch (err) {
        console.error("❌ Schema Fix Error:", err.message);
        // If it fails due to dependencies, we might need to drop CASCADE (dangerous?)
        // Or users can just drop the table since it's a prototype.
        process.exit(1);
    }
}

fixSchema();
