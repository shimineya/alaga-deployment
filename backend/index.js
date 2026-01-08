const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // [OWASP A02] Hides X-Powered-By headers
const rateLimit = require('express-rate-limit'); // [OWASP A07] Mitigation
const { body, validationResult } = require('express-validator'); // [OWASP A05] Input Validation
const bcrypt = require('bcryptjs');
const pool = require('./db');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;

// [OWASP A02] Security Misconfiguration: Restrict Access
// Only allow the frontend (Vite) to talk to the backend.
app.use(cors({
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// [OWASP A02] Add Security Headers
app.use(helmet());

app.use(express.json());

// --- MULTER SECURITY CONFIGURATION ---
// [Security] Store files with unique names to prevent overwriting
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Ensure this folder exists!
    },
    filename: (req, file, cb) => {
        // [Privacy] Rename file to remove original user filename (avoid info leakage)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'id-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// [OWASP A05] File Upload Security
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit: 5MB (Prevents DoS)
    fileFilter: (req, file, cb) => {
        // [Security] Whitelist only safe file types
        const filetypes = /jpeg|jpg|png|pdf/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Error: File upload only supports images and PDFs!'));
    }
});

app.use('/uploads', express.static('uploads'));
const JWT_SECRET = process.env.JWT_SECRET || 'alaga_thesis_secret_key';

// [Security Strategy] Define validation rules for Registration
const registerValidation = [
    // Validate Email
    body('email')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(), // Sanitize: specific@gmail.com -> specific@gmail.com
    
    // Validate Username
    body('username')
        .trim()
        .isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
        .escape(), // [OWASP A05] Prevent XSS payloads in username
        
    // Validate Password (NIST Guidelines: Length > Complexity)
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        // Enforce at least one number and one special char for "Commercial Grade" strength
        .matches(/\d/).withMessage('Password must contain a number')
        .matches(/[!@#$%^&*]/).withMessage('Password must contain a special character'),
        
    // Validate Role (RBAC Enforcement)
    body('role')
        .isIn(['caregiver', 'medical_staff', 'admin']).withMessage('Invalid Role Assignment')
];

// [OWASP A07] Rate Limiting: Prevent Brute Force Account Creation
const createAccountLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5, // Limit each IP to 5 account creations per hour
    message: "Too many accounts created from this IP, please try again after an hour."
});

// 1. SECURE REGISTER (Updated Route & Fields)
app.post('/api/auth/signup', // <--- FIX: Matches Frontend Route
    createAccountLimiter, 
    registerValidation,   
    async (req, res) => {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        // [Data Integrity] Deconstruct ALL fields sent by SignUp.tsx
        const { username, password, email, role, mobile_number, first_name, last_name, middle_initial } = req.body;
        
        const userCheck = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $2', 
            [username, email]
        );
        
        if (userCheck.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Username or Email already exists' });
        }

        const salt = await bcrypt.genSalt(12);
        const password_hash = await bcrypt.hash(password, salt);

        // [Fix] Update INSERT to include new Progress Report fields
        const newUser = await pool.query(
            `INSERT INTO users (
                username, password_hash, email, role, 
                mobile_number, first_name, last_name, middle_initial, 
                created_at
            ) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
             RETURNING user_id, username, role`,
            [username, password_hash, email, role, mobile_number, first_name, last_name, middle_initial]
        );

        res.status(201).json({ 
            success: true, 
            message: "User registered successfully",
            user: newUser.rows[0] 
        });

    } catch (err) {
        console.error("Registration Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error: Registration Failed' });
    }
});

// ==========================================
// 🚀 ROUTE 2: MEDICAL PROFILE
// ==========================================
app.post('/api/auth/profile/medical', async (req, res) => {
    try {
const { user_id, license_number, specialization, hospital_affiliation, practice_type, is_solo_practitioner } = req.body;
       await pool.query(
    `INSERT INTO profiles_medical_staff (user_id, license_number, specialization, hospital_affiliation, practice_type, is_solo_practitioner)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user_id, license_number, specialization, hospital_affiliation, practice_type, is_solo_practitioner]
);
        res.json({ success: true, message: "Medical profile saved." });
    } catch (err) {
        console.error("Medical Profile Error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================
// 🚀 ROUTE 3: CAREGIVER PROFILE
// ==========================================
app.post('/api/auth/profile/caregiver', async (req, res) => {
    try {
const { user_id, caregiver_type, years_experience, agency_name, work_shift, notification_preferences } = req.body;
        await pool.query(
    `INSERT INTO profiles_caregivers (user_id, caregiver_type, years_experience, agency_name, work_shift, notification_preferences)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user_id, caregiver_type, years_experience, agency_name, work_shift, notification_preferences]
);
        res.json({ success: true, message: "Caregiver profile saved." });
    } catch (err) {
        console.error("Caregiver Profile Error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================
// 🚀 ROUTE 4: DOCUMENT UPLOAD
// ==========================================
// [OWASP A05] Input Validation: Whitelist allowed document types
const ALLOWED_DOC_TYPES = ['government_id', 'medical_license', 'prc_id'];

app.post('/api/auth/upload-document', upload.single('document_file'), async (req, res) => {
    // 1. Transaction Setup: Get a dedicated client from the pool
    const client = await pool.connect();
    
    try {
        // [Validation] Check file existence
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }

        // [Validation] Check Inputs
        const { user_id, document_type } = req.body;
        
        if (!ALLOWED_DOC_TYPES.includes(document_type)) {
            // [Security] Prevent junk data insertion
            return res.status(400).json({ success: false, message: "Invalid document type." });
        }

        // [Security Debt] user_id currently comes from body. 
        // TODO: Move to req.user.id once JWT Middleware is implemented (OWASP A01).

        const fileUrl = `/uploads/${req.file.filename}`; // Adjusted path to match Multer config

        // 2. START TRANSACTION
        await client.query('BEGIN');

        // Step A: Insert the document record
        await client.query(
            // [Fix] match DB schema column 'upload_date'
`INSERT INTO user_documents (user_id, document_type, file_url, verification_status, upload_date)
 VALUES ($1, $2, $3, 'Pending', NOW())`,
            [user_id, document_type, fileUrl]
        );
        
        // Step B: Update the user's status to trigger Admin Review
        await client.query(
            "UPDATE users SET account_status = 'Pending_Review' WHERE user_id = $1", 
            [user_id]
        );

        // 3. COMMIT TRANSACTION (Save changes only if both steps succeeded)
        await client.query('COMMIT');

        res.json({ 
            success: true, 
            message: "Document uploaded securely. Account is now Pending Review.", 
            file_url: fileUrl 
        });

    } catch (err) {
        // 4. ROLLBACK (Undo everything if error occurs)
        await client.query('ROLLBACK');
        
        console.error("Upload Transaction Error:", err.message);
        
        // [OWASP A10] Generic error to client
        res.status(500).json({ success: false, message: "Upload failed due to server error." });
    } finally {
        // 5. Release client back to the pool
        client.release();
    }
});

// ==========================================
// 🚀 ROUTE 5: LOGIN (Corrected & Merged)
// ==========================================
// [OWASP A07] Rate Limiter for Login (Prevent Brute Force)
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

// [FIX] We merged the rate limiter AND the logic into ONE single route.
app.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Allow login by Email OR Username
        const result = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $1', [username]); 
        
        // [Security] Generic error message for both cases
        if (result.rows.length === 0) return res.status(401).json({ success: false, message: "Invalid Credentials" });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) return res.status(401).json({ success: false, message: "Invalid Credentials" });

        // [Security] Generate JWT Token
        const token = jwt.sign({ id: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });

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

// --- Start Server ---
app.listen(port, () => {
    console.log(`✅ ALAGA Server running on port ${port}`);
});