const pool = require('./db');
const fs = require('fs');

async function checkSchema() {
    try {
        let output = "--- tables ---\n";
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        `);
        res.rows.forEach(r => output += `${r.table_name}\n`);

        fs.writeFileSync('db_schema.txt', output);
        console.log("Written to db_schema.txt");
        process.exit();
    } catch (err) {
        fs.writeFileSync('db_schema.txt', "Error: " + err.message);
        process.exit(1);
    }
}

checkSchema();
