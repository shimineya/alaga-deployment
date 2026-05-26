/**
 * generate_admin_hashes.js
 *
 * PURPOSE: Generate bcrypt password hashes (12 salt rounds) for admin seed accounts.
 * Run this script with Node.js BEFORE executing the SQL seed script in pgAdmin4.
 *
 * USAGE:
 *   node generate_admin_hashes.js
 *
 * OUTPUT: Two bcrypt hashes that you paste into create_admin_users.sql
 *
 * [OWASP A04] 12 salt rounds is the project standard (see backend/index.js line 239).
 * [DPA 2012]  Seed passwords should be changed immediately after first login.
 */

const bcrypt = require('bcryptjs');

// --- CHANGE THESE BEFORE RUNNING ---
const FACILITY_ADMIN_PASSWORD = 'FacAdmin@2025!';
const SYSTEM_ADMIN_PASSWORD   = 'SysAdmin@2025!';
// ------------------------------------

(async () => {
    console.log('\n--- Alaga Admin Hash Generator ---');
    console.log('[OWASP A04] Using bcrypt with 12 salt rounds\n');

    const facilityHash = await bcrypt.hash(FACILITY_ADMIN_PASSWORD, 12);
    const systemHash   = await bcrypt.hash(SYSTEM_ADMIN_PASSWORD, 12);

    console.log('Facility Admin password hash:');
    console.log(facilityHash);
    console.log('');
    console.log('System Admin password hash:');
    console.log(systemHash);
    console.log('');
    console.log('--- Copy the hashes above into create_admin_users.sql ---');
    console.log('--- Then run the SQL script in pgAdmin4.              ---\n');
})();
