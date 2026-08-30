const pool = require('../db');

/**
 * Ensures system_reports table exists
 */
async function initReportsTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_reports (
                report_id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                report_type VARCHAR(100) NOT NULL,
                severity VARCHAR(50) DEFAULT 'INFO',
                summary TEXT,
                details JSONB DEFAULT '{}'::jsonb,
                generated_by VARCHAR(100) DEFAULT 'SYSTEM',
                is_archived BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_system_reports_category ON system_reports(category);
            CREATE INDEX IF NOT EXISTS idx_system_reports_type ON system_reports(report_type);
            CREATE INDEX IF NOT EXISTS idx_system_reports_archived ON system_reports(is_archived);
            CREATE INDEX IF NOT EXISTS idx_system_reports_created ON system_reports(created_at DESC);
        `);
    } catch (err) {
        console.error('[SystemReportService] Init error:', err.message);
    }
}

/**
 * Creates a system report
 */
async function createSystemReport({
    title,
    category,
    report_type,
    severity = 'INFO',
    summary = '',
    details = {},
    generated_by = 'SYSTEM'
}) {
    try {
        const query = `
            INSERT INTO system_reports (title, category, report_type, severity, summary, details, generated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const values = [title, category, report_type, severity, summary, JSON.stringify(details), generated_by];
        const res = await pool.query(query, values);
        return res.rows[0];
    } catch (err) {
        console.error('[SystemReportService] Failed to create report:', err.message);
        return null;
    }
}

/**
 * Get all reports with optional filtering
 */
async function getReports({ category, search, severity, status = 'active', limit = 100, offset = 0 }) {
    let query = `
        SELECT * FROM system_reports
        WHERE 1=1
    `;
    const params = [];

    if (status === 'active') {
        params.push(false);
        query += ` AND is_archived = $${params.length}`;
    } else if (status === 'archived') {
        params.push(true);
        query += ` AND is_archived = $${params.length}`;
    }

    if (category && category !== 'ALL') {
        params.push(category);
        query += ` AND category = $${params.length}`;
    }

    if (severity && severity !== 'ALL') {
        params.push(severity);
        query += ` AND severity = $${params.length}`;
    }

    if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        query += ` AND (title ILIKE $${params.length} OR summary ILIKE $${params.length} OR report_type ILIKE $${params.length})`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const res = await pool.query(query, params);
    return res.rows;
}

/**
 * Get summary metrics directly from PostgreSQL
 */
async function getReportsMetrics() {
    const res = await pool.query(`
        SELECT
            COUNT(*) AS total_reports,
            COUNT(*) FILTER (WHERE is_archived = FALSE) AS active_reports,
            COUNT(*) FILTER (WHERE is_archived = TRUE) AS archived_reports,
            COUNT(*) FILTER (WHERE category = 'Security & Authentication' AND is_archived = FALSE) AS security_count,
            COUNT(*) FILTER (WHERE category = 'Audit Trail & Access Governance' AND is_archived = FALSE) AS governance_count,
            COUNT(*) FILTER (WHERE category = 'Hardware & IoT Infrastructure' AND is_archived = FALSE) AS hardware_count,
            COUNT(*) FILTER (WHERE category = 'Application Performance & Reliability' AND is_archived = FALSE) AS performance_count,
            COUNT(*) FILTER (WHERE category = 'Multi-Tenant & Facility Management' AND is_archived = FALSE) AS tenancy_count,
            COUNT(*) FILTER (WHERE report_type = 'DEVICE_PAIRING' AND is_archived = FALSE) AS device_pairing_count
        FROM system_reports;
    `);
    return res.rows[0];
}

/**
 * Archive or Unarchive a report
 */
async function toggleArchiveReport(reportId, isArchived) {
    const res = await pool.query(
        `UPDATE system_reports SET is_archived = $1, updated_at = NOW() WHERE report_id = $2 RETURNING *`,
        [isArchived, reportId]
    );
    return res.rows[0];
}

/**
 * Delete a report
 */
async function deleteReport(reportId) {
    const res = await pool.query(
        `DELETE FROM system_reports WHERE report_id = $1 RETURNING *`,
        [reportId]
    );
    return res.rows[0];
}

/**
 * Hook for device pairing auto-report generation
 */
async function recordDevicePairingReport({ serial_number, device_name, patient_id, patient_name, assigned_by, facility_id, facility_name }) {
    const summary = `Hardware sensor ${serial_number} (${device_name || 'ESP32'}) paired successfully to Patient #${patient_id}${patient_name ? ` (${patient_name})` : ''}. Baseline monitoring initialized.`;
    const details = {
        serial_number,
        device_name: device_name || (serial_number.startsWith('SD') ? 'Smart Diaper Sensor' : 'Vital Signs Monitor'),
        patient_id,
        patient_name: patient_name || 'Patient #' + patient_id,
        facility_id: facility_id || null,
        facility_name: facility_name || 'Central Facility',
        paired_at: new Date().toISOString(),
        paired_by: assigned_by || 'SYSTEM',
        status: 'ACTIVE_MONITORING'
    };

    return await createSystemReport({
        title: `Device Pairing & Enrollment Report - ${serial_number}`,
        category: 'Hardware & IoT Infrastructure',
        report_type: 'DEVICE_PAIRING',
        severity: 'INFO',
        summary,
        details,
        generated_by: assigned_by || 'SYSTEM_DEVICE_HOOK'
    });
}

/**
 * Fetch 100% real live telemetry data for the 5 observability pillars from PostgreSQL
 */
async function getLivePillarsData() {
    const [
        userCounts,
        failedLogins,
        ipBlacklist,
        sessionRevocations,
        auditActions,
        permissionOverrides,
        legalConsent,
        archiveStats,
        devices,
        hardwareAlerts,
        facilities,
        pgActivity
    ] = await Promise.all([
        // Real user counts & roles
        pool.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(*) FILTER (WHERE account_status = 'Active') as active_users,
                COUNT(*) FILTER (WHERE account_status = 'Pending_Review') as pending_users,
                COUNT(*) FILTER (WHERE role IN ('admin', 'system_admin', 'sysadmin')) as admin_users,
                COUNT(*) FILTER (WHERE role = 'facility_admin') as facility_admins,
                COUNT(*) FILTER (WHERE role = 'medical_staff') as medical_staff,
                COUNT(*) FILTER (WHERE role = 'caregiver') as caregivers,
                COUNT(*) FILTER (WHERE role = 'parent') as parents
            FROM users WHERE is_archived IS DISTINCT FROM TRUE
        `),
        // Real failed logins from access_logs (past 24h)
        pool.query(`
            SELECT 
                COUNT(*) as failed_attempts,
                COUNT(DISTINCT user_id) as affected_users
            FROM access_logs 
            WHERE (action ILIKE '%FAILED%' OR action ILIKE '%LOCK%' OR severity = 'CRITICAL')
              AND timestamp >= NOW() - INTERVAL '24 hours'
        `),
        // Real IP Blacklist
        pool.query(`
            SELECT id, ip_address, reason, banned_by, banned_at 
            FROM ip_blacklist 
            WHERE is_archived IS DISTINCT FROM TRUE 
            ORDER BY banned_at DESC LIMIT 10
        `),
        // Real session revocations
        pool.query(`
            SELECT COUNT(*) as total_revocations 
            FROM session_revocations
        `),
        // Real access log action breakdown
        pool.query(`
            SELECT action, COUNT(*) as count 
            FROM access_logs 
            WHERE timestamp >= NOW() - INTERVAL '7 days' 
            GROUP BY action 
            ORDER BY count DESC LIMIT 8
        `),
        // Real active permission overrides
        pool.query(`
            SELECT upo.module_id, upo.can_read, upo.can_write, upo.can_delete, upo.granted_at,
                   u.email, u.role, u.first_name, u.last_name
            FROM user_permission_overrides upo
            JOIN users u ON u.id = upo.user_id
            WHERE upo.revoked_at IS NULL
            LIMIT 10
        `),
        // Real legal consent compliance
        pool.query(`
            SELECT COUNT(*) as total_legal_docs FROM legal_documents
        `),
        // Real archives
        pool.query(`
            SELECT 
                COUNT(*) as total_archived,
                COUNT(*) FILTER (WHERE entity_type = 'Patient') as archived_patients,
                COUNT(*) FILTER (WHERE entity_type = 'User') as archived_users,
                COUNT(*) FILTER (WHERE entity_type = 'Device') as archived_devices
            FROM archives
        `),
        // Real devices
        pool.query(`
            SELECT 
                status,
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE assigned_patient_id IS NOT NULL) as paired_count
            FROM device_whitelist 
            WHERE is_archived IS DISTINCT FROM TRUE 
            GROUP BY status
        `),
        // Real hardware system alerts
        pool.query(`
            SELECT 
                COUNT(*) as total_hardware_alerts,
                COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical_alerts,
                COUNT(*) FILTER (WHERE resolved_at IS NULL) as unresolved_alerts
            FROM hardware_system_alerts
        `),
        // Real facilities
        pool.query(`
            SELECT 
                f.facility_id, 
                f.facility_name, 
                COUNT(DISTINCT p.patient_id) as patients, 
                COUNT(DISTINCT dw.serial_number) as devices
            FROM facilities f 
            LEFT JOIN patients p ON p.facility_id = f.facility_id AND p.is_archived = FALSE 
            LEFT JOIN device_whitelist dw ON dw.facility_id = f.facility_id 
            WHERE f.is_archived IS DISTINCT FROM TRUE
            GROUP BY f.facility_id, f.facility_name
        `),
        // Real DB activity & connections
        pool.query(`
            SELECT count(*) as active_connections FROM pg_stat_activity
        `)
    ]);

    return {
        users: userCounts.rows[0] || {},
        security: {
            failed_logins_24h: parseInt(failedLogins.rows[0]?.failed_attempts || 0),
            affected_users: parseInt(failedLogins.rows[0]?.affected_users || 0),
            blocked_ips: ipBlacklist.rows || [],
            session_revocations: parseInt(sessionRevocations.rows[0]?.total_revocations || 0)
        },
        governance: {
            audit_actions: auditActions.rows || [],
            overrides: permissionOverrides.rows || [],
            legal_docs_count: parseInt(legalConsent.rows[0]?.total_legal_docs || 0),
            archives: archiveStats.rows[0] || {}
        },
        hardware: {
            device_status_breakdown: devices.rows || [],
            alerts: hardwareAlerts.rows[0] || {}
        },
        tenancy: {
            facilities: facilities.rows || []
        },
        performance: {
            active_connections: parseInt(pgActivity.rows[0]?.active_connections || 1),
            uptime_seconds: Math.floor(process.uptime()),
            server_time: new Date().toISOString()
        }
    };
}

// Initialize table on load
initReportsTable();

module.exports = {
    initReportsTable,
    createSystemReport,
    getReports,
    getReportsMetrics,
    toggleArchiveReport,
    deleteReport,
    recordDevicePairingReport,
    getLivePillarsData
};
