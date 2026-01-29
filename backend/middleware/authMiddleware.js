const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'alaga_thesis_secret_key';

// [OWASP A01] Verify Token & Extract User
const verifyToken = (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access Denied: No Token Provided' });
    }

    try {
        // Remove "Bearer " prefix if present
        const cleanToken = token.replace('Bearer ', '');
        const verified = jwt.verify(cleanToken, JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({ success: false, message: 'Invalid Token' });
    }
};

// [OWASP A01] Role-Based Access Control (RBAC)
const verifyAdmin = async (req, res, next) => {
    // 1. Ensure verifyToken ran first
    if (!req.user || !req.user.id) {
        return res.status(403).json({ success: false, message: 'Access Forbidden: Identity Unknown' });
    }

    try {
        // 2. Double-check role in DB (Tokens can be stale if user was just demoted)
        const result = await pool.query(
            'SELECT role FROM users WHERE user_id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
            // [OWASP A09] Security Logging: Log unauthorized admin access attempt
            await pool.query(
                `INSERT INTO access_logs (user_id, action, status, severity, resource_affected, ip_address)
                 VALUES ($1, 'UNAUTHORIZED_ACCESS', 'FAILURE', 'WARNING', 'Admin Dashboard', $2)`,
                [req.user.id, req.ip]
            );

            return res.status(403).json({ success: false, message: 'Access Forbidden: Admins Only' });
        }

        next(); // User is Admin, proceed.
    } catch (err) {
        console.error("RBAC Error:", err.message);
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

// Update exports:
module.exports = { verifyToken, verifyAdmin, checkMaintenance, checkIpBan };