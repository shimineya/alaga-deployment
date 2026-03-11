const pool = require('./db');

async function migratePrivacy() {
    try {
        console.log("--- Migrating for Privacy (Removing MAC Addresses) ---");

        // 1. device_whitelist table
        // Check if column 'mac_address' exists
        const check1 = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'device_whitelist' AND column_name = 'mac_address'
        `);

        if (check1.rows.length > 0) {
            console.log("Renaming device_whitelist.mac_address -> serial_number...");
            await pool.query('ALTER TABLE device_whitelist RENAME COLUMN mac_address TO serial_number');
        }

        // Change type to VARCHAR(50) (if it was macaddr)
        console.log("Adjusting serial_number type to VARCHAR(50)...");
        await pool.query('ALTER TABLE device_whitelist ALTER COLUMN serial_number TYPE VARCHAR(50) USING serial_number::varchar');


        // 2. patients table
        // Check if column 'device_mac_address' exists
        const check2 = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'patients' AND column_name = 'device_mac_address'
        `);

        if (check2.rows.length > 0) {
            console.log("Renaming patients.device_mac_address -> device_serial_number...");
            await pool.query('ALTER TABLE patients RENAME COLUMN device_mac_address TO device_serial_number');
        }

        // Change type to VARCHAR(50)
        console.log("Adjusting device_serial_number type to VARCHAR(50)...");
        await pool.query('ALTER TABLE patients ALTER COLUMN device_serial_number TYPE VARCHAR(50)');

        console.log("✅ Privacy Migration Complete.");
        process.exit(0);

    } catch (err) {
        console.error("❌ Migration Error:", err.message);
        process.exit(1);
    }
}

migratePrivacy();
