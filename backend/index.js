const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // [OWASP A02] Security Headers
const rateLimit = require('express-rate-limit'); // [OWASP A07] Brute Force Protection
const { body, validationResult } = require('express-validator'); // [OWASP A05] Input Validation
const bcrypt = require('bcryptjs');
const pool = require('./db');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const fs = require('fs');

// --- IMPORTS: ROUTE MODULES ---
// [ISO 25010] Modularity: Separating Admin logic from the main server file
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'alaga_thesis_secret_key';

// [OWASP A02] Security Configuration: Dynamic CORS Whitelisting
// Extracts the production Netlify URL from Render's Environment Variables
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL // Must be set in Render Dashboard (e.g., 'https://alaga-app.netlify.app')
].filter(Boolean); // Removes undefined values when running locally to prevent mapping errors

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(helmet());
app.use(express.json());

// [FIX] Handle JSON Parse Errors (e.g. malformed body) which cause 400
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('Bad JSON Body:', err.message);
        return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    }
    next(err);
});

// Request Logging for Debugging
app.use((req, res, next) => {
    const log = `[${new Date().toISOString()}] ${req.method} ${req.url}`;
    console.log(log);
    fs.appendFileSync('server.log', log + '\n');
    next();
});

// --- MULTER CONFIGURATION (File Uploads) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
        cb(null, 'uploads/'); // Ensure this folder exists
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'id-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|pdf/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Error: File upload only supports images and PDFs!'));
    }
});

app.use('/uploads', express.static('uploads'));

// --- VALIDATION RULES ---
const registerValidation = [
    body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
    body('username').optional({ checkFalsy: true }).trim().escape(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    // [OWASP A01] Added facility_admin and system_admin to the allowed role list
    body('role').isIn(['caregiver', 'medical_staff', 'admin', 'facility_admin', 'system_admin']).withMessage('Invalid role selected')
];

// --- RATE LIMITERS ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Increased limit for testing purposes
    message: "Too many login attempts, please try again later."
});

// ==========================================
// ROUTE 1: REGISTER 
// ==========================================
app.post(['/api/auth/register', '/api/auth/signup'], authLimiter, registerValidation, async (req, res) => {
    // [FIX] Extract the specific error message for the frontend
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const firstError = errors.array()[0].msg;
        console.log("Validation Failed:", firstError);
        return res.status(400).json({ success: false, message: firstError, errors: errors.array() });
    }

    try {
        let { username, password, email, role, mobile_number, first_name, last_name, middle_initial } = req.body;
        console.log(`Registering user: ${email}`);

        // [Fix] Force Email to Lowercase immediately for consistency
        const safeEmail = email.toLowerCase().trim();

        // Auto-generate Username if empty
        if (!username || username.trim() === '') {
            username = safeEmail.split('@')[0];
        }

        // Check if user exists
        const userCheck = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $2',
            [username, safeEmail]
        );

        if (userCheck.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Username or Email already exists' });
        }

        const salt = await bcrypt.genSalt(12);
        const password_hash = await bcrypt.hash(password, salt);

        // Insert User (Active by default for Caregivers/Home Use)
        const newUser = await pool.query(
            `INSERT INTO users (
                username, password_hash, email, role, 
                mobile_number, first_name, last_name, middle_initial, 
                account_status, created_at
            ) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active', NOW()) 
             RETURNING user_id, username, role, email, account_status`,
            [
                username,
                password_hash,
                safeEmail, // Storing as lowercase
                role || 'caregiver',
                mobile_number,
                first_name,
                last_name,
                middle_initial || null
            ]
        );

        const createdUser = newUser.rows[0];

        // Generate Token (Auto-Login)
        const token = jwt.sign(
            { id: createdUser.user_id, role: createdUser.role },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.status(201).json({
            success: true,
            message: "Account created successfully",
            token: token,
            user: createdUser
        });

    } catch (err) {
        console.error("Registration Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error: ' + err.message });
    }
});

// ==========================================
// ROUTE 2: LOGIN 
// ==========================================
app.post(['/login', '/api/auth/login'], authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(`Login attempt for: ${username}`);

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Please enter both username and password" });
        }

        // [Fix] Normalization Logic (Matches Registration)
        let searchKey = username;
        if (username.includes('@')) {
            searchKey = username.toLowerCase().trim();
        }

        // Database Query
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR username = $1',
            [searchKey]
        );

        // [FIX] Specific Error: User Not Found
        if (result.rows.length === 0) {
            console.log("Login failed: User not found");
            return res.status(404).json({ success: false, message: "User not found. Please register." });
        }

        const user = result.rows[0];

        // [OWASP A07] Check if account is locked
        if (user.is_locked) {
            return res.status(403).json({ success: false, message: "Account is locked. Contact Admin." });
        }

        // Password Check
        const validPassword = await bcrypt.compare(password, user.password_hash);

        // [FIX] Specific Error: Wrong Password
        if (!validPassword) {
            console.log("Login failed: Incorrect Password");
            return res.status(401).json({ success: false, message: "Incorrect password. Please try again." });
        }

        // Success Token
        const token = jwt.sign(
            { id: user.user_id, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            message: "Welcome back!",
            token,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                name: user.first_name, // Added for frontend display
                account_status: user.account_status
            }
        });

    } catch (err) {
        console.error("Login Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error during login' });
    }
});

// ==========================================
// ROUTE 2B: LOGOUT (clears online status)
// ==========================================
const { verifyToken } = require('./middleware/authMiddleware');
app.post('/api/auth/logout', verifyToken, async (req, res) => {
    try {
        // Clear activity timestamp so the user immediately appears Offline
        await pool.query('UPDATE users SET last_activity_at = NULL WHERE user_id = $1', [req.user.id]);
        res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err) {
        // Even if this fails, the frontend still clears localStorage
        res.json({ success: true, message: 'Logged out.' });
    }
});

// ==========================================
// ROUTE 2C: FETCH OWN PERMISSIONS
// [OWASP A01] Scoped strictly to req.user.id from the verified JWT.
// No IDOR risk — a user can only see their own permission map.
// [HIPAA] Minimum Necessary: returns only boolean flags, no PHI.
// ==========================================
app.get('/api/auth/my-permissions', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const role   = req.user.role;

        // [OWASP A01] System Admins bypass all restrictions.
        // Return an empty override map; the frontend treats missing keys as "granted".
        const sysAdminRoles = ['system_admin', 'admin', 'sysadmin'];
        if (sysAdminRoles.includes(role)) {
            return res.json({ success: true, permissions: {}, isSysAdmin: true });
        }

        // Step 1: Load role-level defaults from role_permissions table
        const roleResult = await pool.query(
            'SELECT module_id, is_enabled FROM role_permissions WHERE role = $1',
            [role]
        );

        // Step 2: Load per-user overrides (highest priority)
        const overrideResult = await pool.query(
            'SELECT module_id, is_granted FROM user_permission_overrides WHERE user_id = $1',
            [userId]
        );

        // Step 3: Merge — start from role defaults, then apply overrides on top
        // [OWASP A05] Both queries above use parameterized inputs — no injection risk.
        const permissions = {};

        roleResult.rows.forEach(row => {
            permissions[row.module_id] = row.is_enabled;
        });

        overrideResult.rows.forEach(row => {
            // Override explicitly sets the value, regardless of role default
            permissions[row.module_id] = row.is_granted;
        });

        res.json({ success: true, permissions, isSysAdmin: false });

    } catch (err) {
        // [OWASP A10] Generic error — do not expose stack trace to frontend
        res.status(500).json({ success: false, message: 'Could not load permissions.' });
    }
});

// ==========================================
// ROUTE 2C: BREAK GLASS PROTOCOL (OWASP A01 & A09 Mitigation)
// ==========================================
app.post('/api/auth/break-glass', verifyToken, async (req, res) => {
    try {
        const { justification_code, target_hub } = req.body;
        const user_id = req.user.id;
        const role = req.user.role?.toLowerCase() || '';

        // Only System Admins perform break-glass. Facility Admins and Clinical staff have natural RBAC limits or full access.
        if (!['system_admin', 'admin', 'sysadmin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Break-glass protocol is restricted to System Administrators.' });
        }

        // [TECHNICAL DEBT/PROTOTYPING] Dev bypass rule matching frontend UI bypass.
        const code = justification_code && justification_code.trim().length >= 5 ? justification_code.trim() : 'DEV-BYPASS-00000';

        if (code.length < 5) {
            return res.status(400).json({ success: false, message: 'A valid justification code is required (min 5 chars).' });
        }

        // Issue new short-lived token (15 mins) with break_glass_active flag
        const elevatedToken = jwt.sign(
            { id: user_id, role: req.user.role, break_glass_active: true },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        // [OWASP A09] Parameterized Logging of PHI Access Control Override
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'] || 'Unknown';

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity, user_agent, ip_address, details)
             VALUES ($1, 'BREAK_GLASS_ACCESS', $2, 'WARNING', $3, $4, $5)`,
            [
                user_id,
                target_hub || 'PHI_ACCESS',
                userAgent,
                ip,
                JSON.stringify({ justification_code: code, timestamp: new Date().toISOString() })
            ]
        );

        res.json({
            success: true,
            message: 'Break-Glass authorized. Session expires in 15 minutes.',
            token: elevatedToken
        });

    } catch (err) {
        console.error("Break-Glass Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error during Break-Glass instantiation.' });
    }
});

// ==========================================
// ROUTE 3: DOCUMENT UPLOAD
// ==========================================
const ALLOWED_DOC_TYPES = ['government_id', 'medical_license', 'prc_id'];

app.post('/api/auth/upload-document', upload.single('document_file'), async (req, res) => {
    const client = await pool.connect();
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });

        const { user_id, document_type } = req.body;
        if (!ALLOWED_DOC_TYPES.includes(document_type)) {
            return res.status(400).json({ success: false, message: "Invalid document type." });
        }

        const fileUrl = `/uploads/${req.file.filename}`;

        await client.query('BEGIN');
        await client.query(
            `INSERT INTO user_documents (user_id, document_type, file_url, verification_status, upload_date)
             VALUES ($1, $2, $3, 'Pending', NOW())`,
            [user_id, document_type, fileUrl]
        );

        await client.query(
            "UPDATE users SET account_status = 'Pending_Review' WHERE user_id = $1",
            [user_id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Document uploaded.", file_url: fileUrl });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Upload Error:", err.message);
        res.status(500).json({ success: false, message: "Upload failed." });
    } finally {
        client.release();
    }
});

// ==========================================
// ROUTE 4: LEGACY ADMIN MODULE (backward-compatible)
// ==========================================
// [Security] Mounts the legacy admin router. All routes protected by verifyToken + verifyAdmin
// URL Prefix: http://localhost:3000/api/admin/
app.use('/api/admin', adminRoutes);

// ==========================================
// ROUTE 5: FACILITY ADMIN MODULE
// ==========================================
// [OWASP A01] Protected by verifyToken + verifyFacilityAdmin + RLS (facility_id scoping)
// URL Prefix: http://localhost:3000/api/facility-admin/
const facilityAdminRoutes = require('./routes/facilityAdminRoutes');
app.use('/api/facility-admin', facilityAdminRoutes);

// ==========================================
// ROUTE 6: SYSTEM ADMIN MODULE
// ==========================================
// [OWASP A01] Protected by verifyToken + verifySuperAdmin (system_admin or admin role)
// URL Prefix: http://localhost:3000/api/sysadmin/
const sysAdminRoutes = require('./routes/sysAdminRoutes');
app.use('/api/sysadmin', sysAdminRoutes);

// Caregiver & Patient Management Routes
const caregiverRoutes = require('./routes/caregiverRoutes');
app.use('/api/caregiver', caregiverRoutes);

const assignmentRoutes = require('./routes/assignmentRoutes');
app.use('/api/assignments', assignmentRoutes);
const profileRoutes = require('./routes/profileRoutes');
app.use('/api/user/profile', profileRoutes);

// Alerts, Audit, and Triage Routes
const alertsRoutes = require('./routes/alertsRoutes');
app.use('/api/alerts', alertsRoutes);

// --- Start Server ---
const HOST = '0.0.0.0';

app.listen(port, HOST, () => {
    console.log(`✅ ALAGA Server running on http://${HOST}:${port}`);
    console.log(`📡 Accepting local network connections for mobile testing.`);
});