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

// --- Start Server ---
app.listen(port, () => {
    console.log(`✅ ALAGA Server running on port ${port}`);
});