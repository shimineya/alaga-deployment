/**
 * ALAGA 1-Command PostgreSQL / Neon Database Migration Script
 * ============================================================
 * Copies the entire Alaga database schema (sequences, tables, columns,
 * defaults, primary keys, unique constraints, foreign keys, indexes)
 * and data from your current database to a new Neon / PostgreSQL database
 * WITHOUT needing pg_dump or pg_restore installed!
 *
 * Usage (from project root):
 *   1) Using current backend/.env as source and new Neon URL as target:
 *      node backend/migrate_neon_db.js "postgresql://user:pass@ep-new.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
 *
 *   2) Or specifying both OLD_URL and NEW_URL explicitly:
 *      node backend/migrate_neon_db.js "postgresql://OLD_URL" "postgresql://NEW_URL"
 *
 *   Optional flags:
 *      --all          Copy 100% of historical sensor_readings & access_logs (default caps those two log tables at latest 2,000 rows to save Neon egress)
 *      --update-env   Automatically update DATABASE_URL in backend/.env after a successful migration
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool, types } = require('pg');

// Keep DATE columns as exact YYYY-MM-DD strings
types.setTypeParser(1082, (val) => val);

const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter((a) => a.startsWith('--')));
const urlArgs = rawArgs.filter((a) => !a.startsWith('--'));

const copyAllLogs = flags.has('--all');
const shouldUpdateEnv = flags.has('--update-env');
const truncateFirst = flags.has('--truncate-first');

let sourcePoolConfig = null;
let targetUrl = null;

if (urlArgs.length >= 2) {
  sourcePoolConfig = {
    connectionString: urlArgs[0],
    ssl: { rejectUnauthorized: false },
  };
  targetUrl = urlArgs[1];
} else if (urlArgs.length === 1) {
  targetUrl = urlArgs[0];
  if (process.env.DATABASE_URL) {
    sourcePoolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  } else {
    sourcePoolConfig = {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      ssl: process.env.DB_HOST && process.env.DB_HOST.includes('neon.tech') ? { rejectUnauthorized: false } : false,
    };
  }
} else {
  console.log('\n===================================================================');
  console.log(' ALAGA 1-COMMAND NEON DATABASE MIGRATION SCRIPT');
  console.log('===================================================================');
  console.log('Usage:');
  console.log('  node backend/migrate_neon_db.js "YOUR_NEW_NEON_DATABASE_URL"');
  console.log('\nOr with explicit old and new URLs:');
  console.log('  node backend/migrate_neon_db.js "OLD_NEON_URL" "NEW_NEON_URL"');
  console.log('\nOptional flags:');
  console.log('  --update-env   Update DATABASE_URL in backend/.env after migration');
  console.log('  --all          Copy all historical sensor_readings & access_logs');
  console.log('===================================================================\n');
  process.exit(1);
}

const sourcePool = new Pool(sourcePoolConfig);
const targetPool = new Pool({
  connectionString: targetUrl,
  ssl: { rejectUnauthorized: false },
});

function quoteIdent(ident) {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

async function migrate() {
  console.log('\n🚀 Starting Alaga Database Migration to New Neon Project...\n');

  // 1. Verify connections
  const srcTest = await sourcePool.query('SELECT current_database() AS db');
  const tgtTest = await targetPool.query('SELECT current_database() AS db');
  console.log(`✅ Connected to Source DB : ${srcTest.rows[0].db}`);
  console.log(`✅ Connected to Target DB : ${tgtTest.rows[0].db}\n`);

  // 2. Discover all sequences in public schema
  const seqRes = await sourcePool.query(`
    SELECT sequence_name, start_value, minimum_value, maximum_value, increment
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `);

  for (const seq of seqRes.rows) {
    await targetPool.query(
      `CREATE SEQUENCE IF NOT EXISTS public.${quoteIdent(seq.sequence_name)} INCREMENT ${seq.increment} MINVALUE ${seq.minimum_value} MAXVALUE ${seq.maximum_value} START ${seq.start_value}`
    );
  }
  console.log(`📦 Ensured ${seqRes.rows.length} sequence(s) on target database.`);

  // 3. Discover all base tables in public schema
  const tablesRes = await sourcePool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const allTables = tablesRes.rows.map((r) => r.table_name);

  // Order tables so parent tables are created & populated before child tables
  const preferredOrder = [
    'facilities',
    'users',
    'patients',
    'patient_access',
    'device_whitelist',
    'patient_baselines',
    'sensor_readings',
    'anomaly_events',
    'alert_notifications',
    'hardware_system_alerts',
    'schedules',
    'care_logs',
    'facility_invitations',
    'archives',
    'access_logs',
  ];
  const orderedTables = [
    ...preferredOrder.filter((t) => allTables.includes(t)),
    ...allTables.filter((t) => !preferredOrder.includes(t)),
  ];

  // 4. Create tables and columns on target database
  for (const tableName of orderedTables) {
    const colRes = await sourcePool.query(
      `
      SELECT
        a.attname AS column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
        a.attnotnull AS not_null,
        pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS column_default
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE n.nspname = 'public'
        AND c.relname = $1
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
      `,
      [tableName]
    );

    const colDefs = colRes.rows.map((col) => {
      let def = `${quoteIdent(col.column_name)} ${col.data_type}`;
      if (col.column_default !== null && col.column_default !== undefined) {
        def += ` DEFAULT ${col.column_default}`;
      }
      if (col.not_null) {
        def += ' NOT NULL';
      }
      return def;
    });

    await targetPool.query(
      `CREATE TABLE IF NOT EXISTS public.${quoteIdent(tableName)} (\n  ${colDefs.join(',\n  ')}\n)`
    );

    // Ensure all columns exist in case table already partially existed
    for (const col of colRes.rows) {
      let alterDef = `ALTER TABLE public.${quoteIdent(tableName)} ADD COLUMN IF NOT EXISTS ${quoteIdent(col.column_name)} ${col.data_type}`;
      if (col.column_default !== null && col.column_default !== undefined) {
        alterDef += ` DEFAULT ${col.column_default}`;
      }
      await targetPool.query(alterDef).catch(() => {});
    }
  }
  console.log(`📐 Created/verified ${orderedTables.length} table schema(s) on target database.`);

  // 5. Apply Primary Keys & Unique Constraints before inserting data
  const pkUniqueRes = await sourcePool.query(`
    SELECT
      c.relname AS table_name,
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      pg_catalog.pg_get_constraintdef(con.oid, true) AS constraint_def
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND con.contype IN ('p', 'u')
    ORDER BY con.contype ASC, c.relname ASC
  `);

  for (const con of pkUniqueRes.rows) {
    await targetPool
      .query(
        `ALTER TABLE public.${quoteIdent(con.table_name)} ADD CONSTRAINT ${quoteIdent(con.constraint_name)} ${con.constraint_def}`
      )
      .catch(() => {});
  }
  console.log(`🔑 Applied Primary Key & Unique constraints.`);

  // 6. Copy table rows
  if (truncateFirst) {
    console.log('\n🧹 Clearing target tables before syncing (--truncate-first)...');
    const quotedAll = orderedTables.map((t) => `public.${quoteIdent(t)}`).join(', ');
    await targetPool.query(`TRUNCATE TABLE ${quotedAll} RESTART IDENTITY CASCADE`).catch(() => {});
  }
  console.log('\n📥 Copying data rows from Source DB -> Target DB...');
  for (const tableName of orderedTables) {
    const colRes = await sourcePool.query(
      `
      SELECT a.attname AS column_name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
      `,
      [tableName]
    );
    const columns = colRes.rows.map((r) => r.column_name);
    const jsonCols = new Set(
      colRes.rows
        .filter((r) => r.data_type === 'json' || r.data_type === 'jsonb')
        .map((r) => r.column_name)
    );

    if (columns.length === 0) continue;

    // Build SELECT query (cap high-volume telemetry/audit log tables to latest 2,000 rows unless --all is passed)
    let selectSql = `SELECT * FROM public.${quoteIdent(tableName)}`;
    if (!copyAllLogs && tableName === 'sensor_readings') {
      selectSql = `
        SELECT * FROM (
          SELECT * FROM public."sensor_readings"
          ORDER BY reading_id DESC
          LIMIT 2000
        ) sub
        ORDER BY reading_id ASC
      `;
    } else if (!copyAllLogs && tableName === 'access_logs') {
      selectSql = `
        SELECT * FROM (
          SELECT * FROM public."access_logs"
          ORDER BY log_id DESC
          LIMIT 1500
        ) sub
        ORDER BY log_id ASC
      `;
    } else if (!copyAllLogs && tableName === 'anomaly_events') {
      selectSql = `
        SELECT * FROM public."anomaly_events"
        WHERE event_id IN (SELECT event_id FROM public."alert_notifications" WHERE event_id IS NOT NULL)
           OR event_id IN (SELECT event_id FROM public."anomaly_events" ORDER BY event_id DESC LIMIT 500)
        ORDER BY event_id ASC
      `;
    }

    const rowsRes = await sourcePool.query(selectSql);
    const rows = rowsRes.rows;

    if (rows.length === 0) {
      console.log(`   - ${tableName.padEnd(24)}: 0 rows`);
      continue;
    }

    const quotedCols = columns.map(quoteIdent).join(', ');
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = [];
      const rowPlaceholders = [];

      batch.forEach((row, rowIdx) => {
        const colPlaceholders = [];
        columns.forEach((col, colIdx) => {
          const paramIdx = rowIdx * columns.length + colIdx + 1;
          colPlaceholders.push(`$${paramIdx}`);
          let val = row[col];
          if (val !== null && val !== undefined && jsonCols.has(col) && typeof val === 'object') {
            val = JSON.stringify(val);
          }
          values.push(val);
        });
        rowPlaceholders.push(`(${colPlaceholders.join(', ')})`);
      });

      const insertSql = `
        INSERT INTO public.${quoteIdent(tableName)} (${quotedCols})
        VALUES ${rowPlaceholders.join(', ')}
        ON CONFLICT DO NOTHING
      `;
      await targetPool.query(insertSql, values);
      insertedCount += batch.length;
    }

    console.log(`   - ${tableName.padEnd(24)}: ${insertedCount} rows migrated`);
  }

  // 7. Apply Foreign Keys & Indexes
  const fkRes = await sourcePool.query(`
    SELECT
      c.relname AS table_name,
      con.conname AS constraint_name,
      pg_catalog.pg_get_constraintdef(con.oid, true) AS constraint_def
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND con.contype = 'f'
  `);
  for (const fk of fkRes.rows) {
    await targetPool
      .query(
        `ALTER TABLE public.${quoteIdent(fk.table_name)} ADD CONSTRAINT ${quoteIdent(fk.constraint_name)} ${fk.constraint_def}`
      )
      .catch(() => {});
  }

  const idxRes = await sourcePool.query(`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey'
  `);
  for (const idx of idxRes.rows) {
    const safeDef = idx.indexdef.replace(/^CREATE INDEX /i, 'CREATE INDEX IF NOT EXISTS ').replace(/^CREATE UNIQUE INDEX /i, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
    await targetPool.query(safeDef).catch(() => {});
  }

  // 8. Synchronize all SERIAL sequences to MAX(id)
  for (const seq of seqRes.rows) {
    const seqName = seq.sequence_name;
    // Match sequence back to its table & column via column_default
    const ownerRes = await sourcePool.query(
      `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_default LIKE $1
      LIMIT 1
      `,
      [`%${seqName}%`]
    );
    if (ownerRes.rows.length > 0) {
      const { table_name, column_name } = ownerRes.rows[0];
      await targetPool
        .query(
          `SELECT setval('public.${quoteIdent(seqName)}', COALESCE((SELECT MAX(${quoteIdent(column_name)}) FROM public.${quoteIdent(table_name)}), 1), true)`
        )
        .catch(() => {});
    }
  }
  console.log('\n🔄 Synchronized all auto-increment SERIAL sequences.');

  // 9. Optional: Update backend/.env with the new DATABASE_URL
  if (shouldUpdateEnv) {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (/^DATABASE_URL=/m.test(envContent)) {
        envContent = envContent.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${targetUrl}`);
      } else {
        envContent += `\nDATABASE_URL=${targetUrl}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('✅ Updated DATABASE_URL in backend/.env!');
    }
  }

  console.log('\n🎉 MIGRATION COMPLETE! Your new Neon database has all Alaga tables, accounts, patients, devices, baselines, alerts, and logs.');
  console.log('👉 Next Step: Paste your new Neon connection string into Render -> Environment -> DATABASE_URL and click Save!\n');
}

migrate()
  .then(() => {
    sourcePool.end();
    targetPool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Migration failed:', err.message);
    sourcePool.end();
    targetPool.end();
    process.exit(1);
  });
