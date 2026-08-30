const pool = require('../db');
const fs = require('fs');
const path = require('path');

async function dumpSchema() {
    try {
        console.log('Querying PostgreSQL database schema information...');

        // 1. Get all ENUM types
        const enumsQuery = `
            SELECT t.typname AS enum_name, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS enum_values
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
            GROUP BY t.typname;
        `;
        const enumsRes = await pool.query(enumsQuery);

        // 2. Get all tables
        const tablesQuery = `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `;
        const tablesRes = await pool.query(tablesQuery);

        let sql = `-- ============================================================================
-- ALAGA HEALTHCARE MONITORING SYSTEM
-- FULL DATABASE SCHEMA DUMP FOR NEON POSTGRESQL (Lakebase Postgres)
-- Generated on: ${new Date().toISOString()}
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

`;

        // Add ENUMs
        if (enumsRes.rows.length > 0) {
            sql += `-- ----------------------------------------------------------------------------\n-- CUSTOM ENUM TYPES\n-- ----------------------------------------------------------------------------\n`;
            for (const row of enumsRes.rows) {
                const values = row.enum_values.split(', ').map(v => `'${v}'`).join(', ');
                sql += `DO $$ BEGIN\n    CREATE TYPE ${row.enum_name} AS ENUM (${values});\nEXCEPTION\n    WHEN duplicate_object THEN null;\nEND $$;\n\n`;
            }
        }

        // 3. For each table, get columns, constraints, and indexes
        for (const table of tablesRes.rows) {
            const tableName = table.table_name;
            sql += `-- ----------------------------------------------------------------------------\n-- TABLE: ${tableName}\n-- ----------------------------------------------------------------------------\n`;
            sql += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;

            const colsQuery = `
                SELECT 
                    column_name, 
                    data_type, 
                    udt_name,
                    character_maximum_length,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY ordinal_position;
            `;
            const colsRes = await pool.query(colsQuery, [tableName]);

            const colDefs = [];
            for (const col of colsRes.rows) {
                let type = col.data_type.toUpperCase();
                let colDefault = col.column_default;
                let isSerial = false;

                if (colDefault && colDefault.includes('nextval(')) {
                    if (type === 'BIGINT') {
                        type = 'BIGSERIAL';
                    } else {
                        type = 'SERIAL';
                    }
                    colDefault = null; // SERIAL handles sequence automatically
                    isSerial = true;
                } else if (type === 'USER-DEFINED') {
                    type = col.udt_name;
                } else if (type === 'CHARACTER VARYING') {
                    type = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'VARCHAR';
                } else if (type === 'CHARACTER') {
                    type = `CHAR(${col.character_maximum_length || 1})`;
                } else if (type === 'ARRAY') {
                    type = `${col.udt_name.replace(/^_/, '')}[]`;
                }

                let colDef = `    ${col.column_name} ${type}`;
                if (colDefault) {
                    colDef += ` DEFAULT ${colDefault}`;
                }
                if (col.is_nullable === 'NO' && !isSerial) {
                    colDef += ` NOT NULL`;
                }
                colDefs.push(colDef);
            }

            // Primary Key Constraints
            const pkQuery = `
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = 'public'
                  AND tc.table_name = $1
                ORDER BY kcu.ordinal_position;
            `;
            const pkRes = await pool.query(pkQuery, [tableName]);
            if (pkRes.rows.length > 0) {
                const pkCols = pkRes.rows.map(r => r.column_name).join(', ');
                colDefs.push(`    CONSTRAINT ${tableName}_pkey PRIMARY KEY (${pkCols})`);
            }

            sql += colDefs.join(',\n') + '\n);\n\n';
        }

        // 4. Foreign Key Constraints
        sql += `-- ============================================================================\n-- FOREIGN KEY CONSTRAINTS\n-- ============================================================================\n`;
        const fkQuery = `
            SELECT
                tc.table_name,
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.update_rule,
                rc.delete_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints AS rc
              ON rc.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
            ORDER BY tc.table_name, tc.constraint_name;
        `;
        const fkRes = await pool.query(fkQuery);
        for (const fk of fkRes.rows) {
            sql += `DO $$ BEGIN\n    ALTER TABLE public.${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} FOREIGN KEY (${fk.column_name}) REFERENCES public.${fk.foreign_table_name} (${fk.foreign_column_name}) ON UPDATE ${fk.update_rule} ON DELETE ${fk.delete_rule};\nEXCEPTION\n    WHEN duplicate_object THEN null;\nEND $$;\n\n`;
        }

        // 5. Indexes
        sql += `-- ============================================================================\n-- INDEXES\n-- ============================================================================\n`;
        const indexQuery = `
            SELECT indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname NOT LIKE '%_pkey'
            ORDER BY tablename, indexname;
        `;
        const indexRes = await pool.query(indexQuery);
        for (const idx of indexRes.rows) {
            sql += `${idx.indexdef};\n`;
        }

        // Save to file
        const outputPath = path.resolve(__dirname, '../../database_schema_neon.sql');
        fs.writeFileSync(outputPath, sql, 'utf8');
        console.log(`✅ Database schema successfully generated at: ${outputPath}`);
    } catch (err) {
        console.error('❌ Error dumping schema:', err);
    } finally {
        await pool.end();
    }
}

dumpSchema();
