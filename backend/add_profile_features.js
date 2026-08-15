const pool = require('./db');

async function migrate() {
  try {
    console.log('Adding profile_picture_url to users table...');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(255);`);
    console.log('✅ profile_picture_url added.');

    console.log('Updating system_modules for RBAC...');
    // Replace 'settings_personal' if it exists or insert new ones
    
    // We will insert 'settings_profile' and 'settings_preferences'
    const modules = [
      {
        id: 'settings_profile',
        name: 'Account Profile',
        desc: 'Access to view and edit personal account details and picture.',
        cat: 'Settings'
      },
      {
        id: 'settings_preferences',
        name: 'Preferences',
        desc: 'Access to alert preferences, calibration, and UI language.',
        cat: 'Settings'
      }
    ];

    for (const mod of modules) {
      await pool.query(`
        INSERT INTO system_modules (module_id, display_name, description, category) 
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (module_id) 
        DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description;
      `, [mod.id, mod.name, mod.desc, mod.cat]);
    }

    console.log('✅ system_modules updated.');
    
    // Also grant default access to 'settings_profile' for all roles? Yes, it's personal profile.
    const roles = ['system_admin', 'admin', 'facility_admin', 'medical_staff', 'caregiver'];
    for (const role of roles) {
      for (const mod of modules) {
        await pool.query(`
          INSERT INTO role_permissions (role, module_id, is_enabled)
          VALUES ($1, $2, true)
          ON CONFLICT (role, module_id) DO NOTHING;
        `, [role, mod.id]);
      }
    }
    console.log('✅ Default role_permissions set.');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

migrate();
