const pool = require('./db');
const fs = require('fs');

async function checkSchema() {
    try {
        let output = "";

        output += "--- patients columns ---\n";
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'patients';
        `);
        res.rows.forEach(r => output += `${r.column_name} (${r.data_type})\n`);

        output += "\n--- device_whitelist columns ---\n";
        const res2 = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'device_whitelist';
        `);
        res2.rows.forEach(r => output += `${r.column_name} (${r.data_type})\n`);

        fs.writeFileSync('db_schema.txt', output);
        console.log("Written to db_schema.txt");
        process.exit();
    } catch (err) {
        fs.writeFileSync('db_schema.txt', "Error: " + err.message);
        process.exit(1);
    }
}

checkSchema();
