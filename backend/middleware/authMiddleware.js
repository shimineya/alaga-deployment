const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'alaga_thesis_secret_key';

// [Performance] Throttle last_activity_at updates to once per 60s per user
const activityCache = new Map();

// [OWASP A01] Verify Token & Extract User
// [Kill Switch] Also checks the session_revocations table to support instant access revocation
const verifyToken = async (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access Denied: No Token Provided' });
    }

    try {
        // Remove "Bearer " prefix if present
        const cleanToken = token.replace('Bearer ', '');
        const verified = jwt.verify(cleanToken, JWT_SECRET);

        // [OWASP A01 / Kill Switch] Check if this user's sessions have been force-revoked
        // Compares the token's issued-at time (iat) against the revocation timestamp
        const revocationCheck = await pool.query(
            `SELECT 1 FROM session_revocations
             WHERE user_id = $1 AND revoked_before > to_timestamp($2)`,
            [verified.id, verified.iat]
        );

        if (revocationCheck.rows.length > 0) {
            // [OWASP A09] Log the blocked revoked session attempt
            return res.status(401).json({
                success: false,
                message: 'Your session has been terminated by an administrator. Please log in again.'
            });
        }

        req.user = verified;

        // [OWASP A07] Check if account is locked (prevents use of stolen tokens)
        const lockCheck = await pool.query(
            'SELECT is_locked FROM users WHERE user_id = $1',
            [verified.id]
        );
        if (lockCheck.rows[0]?.is_locked) {
            return res.status(401).json({
                success: false,
                message: 'Your session has been terminated by an administrator. Please log in again.'
            });
        }

        // [Activity Tracking] Update last_activity_at (throttled to once per 60s)
        const now = Date.now();
        const lastUpdate = activityCache.get(verified.id) || 0;
        if (now - lastUpdate > 60000) {
            activityCache.set(verified.id, now);
            pool.query(
                'UPDATE users SET last_activity_at = NOW() WHERE user_id = $1',
                [verified.id]
            ).catch(() => { }); // Fire-and-forget, non-blocking
        }

        next();
    } catch (err) {
        // [OWASP A10] Generic error message prevents information leakage
        res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
};

// [OWASP A01] Role-Based Access Control: Legacy Admin (backward compatible)
const verifyAdmin = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(403).json({ success: false, message: 'Access Forbidden: Identity Unknown' });
    }

    try {
        // Double-check role in DB (tokens can be stale if user role changed)
        const result = await pool.query(
            'SELECT role FROM users WHERE user_id = $1',
            [req.user.id]
        );

        const userRole = result.rows[0]?.role;
        const isAdmin = userRole === 'admin' || userRole === 'system_admin' || userRole === 'facility_admin';

        if (result.rows.length === 0 || !isAdmin) {
            // [OWASP A09] Log unauthorized access attempt
            await pool.query(
                `INSERT INTO access_logs (user_id, action, status, severity, resource_affected, ip_address)
                 VALUES ($1, 'UNAUTHORIZED_ACCESS', 'FAILURE', 'WARNING', 'Admin Dashboard', $2)`,
                [req.user.id, req.ip]
            );
            return res.status(403).json({ success: false, message: 'Access Forbidden: Admin Role Required' });
        }

        next();
    } catch (err) {
        console.error('RBAC Error:', err.message);
        res.status(500).json({ success: false, message: 'Server Error during Authorization' });
    }
};

// [OWASP A01] System Admin RBAC — highest privilege tier
// Accepts both 'system_admin' and legacy 'admin' for backward compatibility
const verifySuperAdmin = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(403).json({ success: false, message: 'Access Forbidden: Identity Unknown' });
    }

    try {
        const result = await pool.query(
            'SELECT role FROM users WHERE user_id = $1',
            [req.user.id]
        );

        const userRole = result.rows[0]?.role;
        const isSuperAdmin = userRole === 'system_admin' || userRole === 'admin';

        if (result.rows.length === 0 || !isSuperAdmin) {
            await pool.query(
                `INSERT INTO access_logs (user_id, action, status, severity, resource_affected, ip_address)
                 VALUES ($1, 'UNAUTHORIZED_ACCESS', 'FAILURE', 'CRITICAL', 'System Admin Panel', $2)`,
                [req.user.id, req.ip]
            );
            return res.status(403).json({ success: false, message: 'Access Forbidden: System Admin Role Required' });
        }

        next();
    } catch (err) {
        console.error('Super Admin RBAC Error:', err.message);
        res.status(500).json({ success: false, message: 'Server Error during Authorization' });
    }
};

// [OWASP A01] Facility Admin RBAC — ward-scoped privilege tier
// [System Admin Omniscient View] Also allows system_admin/admin to pass through.
//   When a SysAdmin is the caller, req.user.facility_id is set to NULL so that
//   downstream route handlers can branch to a global (unfiltered) query if needed.
const verifyFacilityAdmin = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(403).json({ success: false, message: 'Access Forbidden: Identity Unknown' });
    }

    try {
        const result = await pool.query(
            'SELECT role, facility_id FROM users WHERE user_id = $1',
            [req.user.id]
        );

        const row = result.rows[0];
        if (!row) {
            return res.status(403).json({ success: false, message: 'Access Forbidden: User not found' });
        }

        const isSysAdmin = row.role === 'system_admin' || row.role === 'admin' || row.role === 'sysadmin';

        // [OWASP A01 / Omniscient View] System Admin is permitted in but scoped differently
        if (isSysAdmin) {
            req.user.facility_id = null; // null signals "all facilities" to route handlers
            req.user.is_sys_admin_override = true;
            return next();
        }

        if (row.role !== 'facility_admin') {
            await pool.query(
                `INSERT INTO access_logs (user_id, action, status, severity, resource_affected, ip_address)
                 VALUES ($1, 'UNAUTHORIZED_ACCESS', 'FAILURE', 'WARNING', 'Facility Admin Panel', $2)`,
                [req.user.id, req.ip]
            );
            return res.status(403).json({ success: false, message: 'Access Forbidden: Facility Admin Role Required' });
        }

        if (!row.facility_id) {
            return res.status(403).json({ success: false, message: 'Access Forbidden: No facility assigned to this account.' });
        }

        // [DPA] Attach facility_id to req for use in route handlers (Row-Level Security)
        req.user.facility_id = row.facility_id;
        next();
    } catch (err) {
        console.error('Facility Admin RBAC Error:', err.message);
        res.status(500).json({ success: false, message: 'Server Error during Authorization' });
    }
};


// [Operational Control] Check if Maintenance Mode is Active
const checkMaintenance = async (req, res, next) => {
    try {
        // 1. Allow Admins to bypass maintenance
        // (We assume verifyToken runs BEFORE this, so req.user is set)
        if (req.user && req.user.role === 'admin') {
            return next();
        }

        // 2. Check DB for global config
        const config = await pool.query(
            "SELECT config_value FROM system_configs WHERE config_key = 'maintenance_mode'"
        );

        if (config.rows.length > 0) {
            const mode = config.rows[0].config_value;
            // config_value is JSONB, so it comes out as an object
            if (mode && mode.enabled === true) {
                return res.status(503).json({
                    success: false,
                    message: 'System is currently under maintenance. Please try again later.'
                });
            }
        }

        next();
    } catch (err) {
        console.error("Maintenance Check Error:", err);
        next(); // Fail open (allow access) if DB errors, or Fail closed? Fail open is safer for prototype.
    }
};

// [Security] Block Banned IPs
const checkIpBan = async (req, res, next) => {
    try {
        const clientIp = req.ip || req.connection.remoteAddress;

        // Check DB (In production, use Redis for speed)
        const check = await pool.query("SELECT * FROM ip_blacklist WHERE ip_address = $1", [clientIp]);

        if (check.rows.length > 0) {
            return res.status(403).json({
                success: false,
                message: 'Access Denied: Your IP address is blacklisted.'
            });
        }
        next();
    } catch (err) {
        next(); // Fail open to avoid blocking legitimate users on DB error
    }
};

// [OWASP A01] Flexible Role Middleware
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ success: false, message: 'Access Denied: Identity Unknown' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Access Forbidden: Insufficient Role' });
        }
        next();
    };
};

// [OWASP A01] Database-driven Permission Middleware (HIPAA Minimum Necessary)
const requirePermission = (moduleId) => {
    return async (req, res, next) => {
        if (!req.user || !req.user.id || !req.user.role) {
            return res.status(401).json({ success: false, message: 'Access Denied: Identity Unknown' });
        }
        
        try {
            // Check for user-specific override first
            const overrideQuery = await pool.query(
                'SELECT is_granted FROM user_permission_overrides WHERE user_id = $1 AND module_id = $2',
                [req.user.id, moduleId]
            );
            
            if (overrideQuery.rows.length > 0) {
                if (overrideQuery.rows[0].is_granted) {
                    return next();
                } else {
                    return res.status(403).json({ success: false, message: `Access Forbidden: Required permission '${moduleId}' denied by override.` });
                }
            }
            
            // System Admins inherently have all permissions or bypass
            if (req.user.role === 'system_admin' || req.user.role === 'admin' || req.user.role === 'sysadmin') {
                 return next();
            }

            // Check role-based permissions
            const roleQuery = await pool.query(
                'SELECT is_enabled FROM role_permissions WHERE role = $1 AND module_id = $2',
                [req.user.role, moduleId]
            );
            
            if (roleQuery.rows.length > 0 && roleQuery.rows[0].is_enabled) {
                return next();
            }
            
            // [OWASP A09] Log failed authorization attempt
            await pool.query(
                `INSERT INTO access_logs (user_id, action, status, severity, resource_affected, ip_address)
                 VALUES ($1, 'UNAUTHORIZED_ACCESS', 'FAILURE', 'WARNING', $2, $3)`,
                [req.user.id, `Module: ${moduleId}`, req.ip || req.connection.remoteAddress]
            ).catch(err => console.error('Failed to log unauthorized access:', err));

            return res.status(403).json({ success: false, message: `Access Forbidden: Required permission '${moduleId}' not granted.` });
        } catch (err) {
            console.error('RBAC Permission Check Error:', err);
            return res.status(500).json({ success: false, message: 'Server Error during Authorization check' });
        }
    };
};

// [OWASP A01 / HIPAA] Break-Glass Enforcement for System Admins
const enforceBreakGlassForSysAdmin = (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Access Denied: Identity Unknown' });
    
    const { role, break_glass_active } = req.user;
    
    // If user is a System Admin, they MUST have an active Break-Glass session to proceed in this route
    if (role === 'system_admin' || role === 'admin' || role === 'sysadmin') {
        if (!break_glass_active) {
            return res.status(403).json({ 
                success: false, 
                message: 'Break-Glass verification required. System Administrators must provide a justification code to access Protected Health Information (PHI).' 
            });
        }
    }
    // All other medical/facility roles bypass this naturally
    next();
};

// [OWASP A01] Export all middleware
module.exports = { verifyToken, verifyAdmin, verifySuperAdmin, verifyFacilityAdmin, checkMaintenance, checkIpBan, requireRole, requirePermission, enforceBreakGlassForSysAdmin };