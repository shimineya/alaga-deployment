// backend/index.js - THE GOLDEN MASTER V1.0
const express = require('express');
const cors = require('cors');
const pool = require('./db'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs');
require('dotenv').config(); 

const app = express();

// --- 1. MIDDLEWARE (CRITICAL) ---
app.use(cors());
app.use(express.json()); // Fixes "Cannot destructure property" error

// --- 2. CONFIG: FILE UPLOAD (Multer) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads/documents';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.body.user_id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only images and PDFs are allowed.'));
        }
    }
});

app.use('/uploads', express.static('uploads'));
const JWT_SECRET = process.env.JWT_SECRET || 'alaga_thesis_secret_key';

// ==========================================
// 🚀 ROUTE 1: SIGNUP (With Mobile Number & JSON Error Handling)
// ==========================================
app.post('/api/auth/signup', async (req, res) => {
    try {
        console.log("📝 Registering:", req.body.email); 

const { username, email, password, role, first_name, last_name, mobile_number, middle_initial } = req.body; // Added middle_initial
        // Check Duplicates
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $2', [email, username]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email or Username already exists.' });
        }

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert User
       const newUser = await pool.query(
    `INSERT INTO users (username, email, password_hash, role, first_name, last_name, mobile_number, middle_initial, is_verified, account_status) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, 'Pending_Review') 
     RETURNING user_id, email, role`,
    [username, email, hashedPassword, role, first_name, last_name, mobile_number || null, middle_initial || null]
);

        console.log("✅ User created ID:", newUser.rows[0].user_id);

        res.status(201).json({ 
            success: true, 
            message: "Account created.", 
            user_id: newUser.rows[0].user_id,
            role: newUser.rows[0].role
        });

    } catch (err) {
        console.error("❌ Signup Error:", err.message);
        res.status(500).json({ success: false, message: "Server Error: " + err.message });
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
app.post('/api/auth/upload-document', upload.single('document_file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });

        const { user_id, document_type } = req.body;
        const fileUrl = `/uploads/documents/${req.file.filename}`;

        await pool.query(
            `INSERT INTO user_documents (user_id, document_type, file_url, verification_status)
             VALUES ($1, $2, $3, 'Pending')`,
            [user_id, document_type, fileUrl]
        );
        
        // Ensure user status is set to Pending Review
        await pool.query("UPDATE users SET account_status = 'Pending_Review' WHERE user_id = $1", [user_id]);

        res.json({ success: true, message: "Document uploaded.", file_url: fileUrl });
    } catch (err) {
        console.error("Upload Error:", err.message);
        res.status(500).json({ success: false, message: "Upload failed." });
    }
});

// ==========================================
// 🚀 ROUTE 5: LOGIN (This was missing!)
// ==========================================
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Allow login by Email OR Username
        const result = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $1', [username]); 
        
        if (result.rows.length === 0) return res.status(401).json({ success: false, message: "Invalid Credentials" });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) return res.status(401).json({ success: false, message: "Invalid Credentials" });

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
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Start Server ---
app.listen(3000, () => {
    console.log('✅ ALAGA Server running on port 3000');
});