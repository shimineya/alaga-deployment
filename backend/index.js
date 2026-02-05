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

// --- IMPORTS: ROUTE MODULES ---
// [ISO 25010] Modularity: Separating Admin logic from the main server file
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'alaga_thesis_secret_key';

// [OWASP A02] Security Configuration
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

const fs = require('fs');

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

app.use((req, res, next) => {
    fs.appendFileSync('server.log', `[REQUEST] ${req.method} ${req.url}\n`);
    next();
});

// --- MULTER CONFIGURATION (File Uploads) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
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
    body('email').isEmail().normalizeEmail(),
    body('username').optional({ checkFalsy: true }).trim().escape(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    body('role').isIn(['caregiver', 'medical_staff', 'admin'])
];

// --- RATE LIMITERS ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per window
    message: "Too many login attempts, please try again later."
});

// ==========================================
// 🚀 ROUTE 1: REGISTER (Home Use Optimized)
// ==========================================
app.post('/api/auth/signup', authLimiter, registerValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        let { username, password, email, role, mobile_number, first_name, last_name, middle_initial } = req.body;

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
            message: "User registered successfully",
            token: token,
            user: createdUser
        });

    } catch (err) {
        console.error("Registration Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// ==========================================
// 🚀 ROUTE 2: LOGIN (Dual Path + Fixed Logic)
// ==========================================
app.post(['/login', '/api/auth/login'], authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Missing username or password" });
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

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid Credentials" });
        }

        const user = result.rows[0];

        // [OWASP A07] Check if account is locked
        if (user.is_locked) {
            return res.status(403).json({ success: false, message: "Account is locked. Contact Admin." });
        }

        // Password Check
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: "Invalid Credentials" });
        }

        // Success Token
        const token = jwt.sign(
            { id: user.user_id, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                account_status: user.account_status
            }
        });

    } catch (err) {
        console.error("Login Error:", err.message);
        res.status(500).send('Server Error');
    }
});

// ==========================================
// 🚀 ROUTE 3: DOCUMENT UPLOAD
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
// 🚀 ROUTE 4: ADMIN DASHBOARD MODULE
// ==========================================
// [Security] Mounts the admin router. All routes inside are protected by verifyToken + verifyAdmin
// URL Prefix: http://localhost:3000/api/admin/audit-logs
app.use('/api/admin', adminRoutes);

// [NEW] Caregiver & Patient Management Routes
const caregiverRoutes = require('./routes/caregiverRoutes');
app.use('/api/caregiver', caregiverRoutes);

const assignmentRoutes = require('./routes/assignmentRoutes');
app.use('/api/assignments', assignmentRoutes);


// --- Start Server ---
app.listen(port, () => {
    console.log(`✅ ALAGA Server running on port ${port}`);
});