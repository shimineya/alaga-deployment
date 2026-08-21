const pool = require('./db');

async function setAdmin() {
  const client = await pool.connect();
  try {
    const email = 'cabnels42@gmail.com'; // Adjust this to the email of the target user
    const newRole = 'system_admin';     // Can be 'system_admin', 'admin', or 'facility_admin'
    
    const res = await client.query(
      "UPDATE users SET role = $1, account_status = 'Active' WHERE email = $2 RETURNING user_id, username, email, role, account_status",
      [newRole, email]
    );

    if (res.rowCount > 0) {
      console.log(`✅ Successfully updated user role:`);
      console.table(res.rows);
    } else {
      console.log(`❌ No user found with email: ${email}`);
    }
  } catch (err) {
    console.error("❌ Error updating user role:", err);
  } finally {
    client.release();
    pool.end();
  }
}

setAdmin();
