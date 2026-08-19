require('dotenv').config(); // [OWASP A02] Load env vars before any other module reads them
const express = require('express');
const cors = require('cors');
const app = express();

const helmet = require('helmet'); // [OWASP A02] Security Headers
const rateLimit = require('express-rate-limit'); // [OWASP A07] Brute Force Protection
const { body, validationResult } = require('express-validator'); // [OWASP A05] Input Validation
const bcrypt = require('bcryptjs');
const pool = require('./db');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const scheduleRoutes = require('./routes/schedules');
const { Resend } = require('resend');
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// --- IMPORTS: ROUTE MODULES ---
// [ISO 25010] Modularity: Separating Admin logic from the main server file
const adminRoutes = require('./routes/adminRoutes');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const JWT_SECRET = process.env.JWT_SECRET || 'alaga_thesis_secret_key';
const OTP_EXPIRY_MINUTES = 10;

// [OWASP A02] Security Configuration: Dynamic CORS Whitelisting
// Extracts the production Netlify URL from Render's Environment Variables
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://alaga01.netlify.app',
    process.env.FRONTEND_URL // Must be set in Render Dashboard (e.g., 'https://alaga-app.netlify.app')
].filter(Boolean); // Removes undefined values when running locally to prevent mapping errors

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], // [OWASP A02] Added PATCH — used by ApiService.patch()
    credentials: true
}));

app.use(helmet());
app.use(express.json());

// [NOTE] JSON parse error handler moved to AFTER all route registrations
// (Express error-handling middleware requires 4 params and must be placed after routes).

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
    // [FIX] gmail_remove_dots: false preserves dots in Gmail addresses.
    // Without this, 'coronado.carlgab@gmail.com' becomes 'coronadocarlgab@gmail.com',
    // which confuses users even though Gmail treats them as the same inbox.
    body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail({ gmail_remove_dots: false }),
    body('username').optional({ checkFalsy: true }).trim().escape(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    // [OWASP A01] Added facility_admin, system_admin, and parent to the allowed role list
    body('role').isIn(['caregiver', 'medical_staff', 'admin', 'facility_admin', 'system_admin', 'parent']).withMessage('Invalid role selected')
];

// --- RATE LIMITERS ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Increased limit for testing purposes
    message: "Too many login attempts, please try again later."
});

const hashOtp = (otp) =>
    crypto.createHash('sha256').update(otp).digest('hex');

const generateOtp = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

const validateEmailDomain = async (email) => {
    const domain = email.split('@')[1];
    if (!domain) return false;
    try {
        const records = await dns.resolveMx(domain);
        return Array.isArray(records) && records.length > 0;
    } catch {
        return false;
    }
};

const loadSmtpConfig = async () => {
    // [FIX] Try DB first, then fall back to .env variables.
    // Previously, when the DB had no smtp_config row, this returned null
    // even though env vars were available -- causing all OTP emails to fail.
    try {
        const result = await pool.query(
            "SELECT config_value FROM system_configs WHERE config_key = 'smtp_config'"
        );
        if (result.rows.length > 0) {
            const cfg = result.rows[0].config_value || {};
            // DB config found -- merge with env vars as fallback
            return {
                host: cfg.host || cfg.smtp_host || process.env.SMTP_HOST,
                port: Number(cfg.port || cfg.smtp_port || process.env.SMTP_PORT || 587),
                secure: Boolean(cfg.secure === true || cfg.smtp_secure === true),
                user: cfg.user || cfg.username || cfg.smtp_user || process.env.SMTP_USER,
                pass: cfg.pass || cfg.password || cfg.smtp_pass || process.env.SMTP_PASS,
                from: cfg.from || cfg.from_email || process.env.SMTP_FROM || 'no-reply@alaga.local',
            };
        }
    } catch (dbErr) {
        // [OWASP A10] DB read failure should not block email; fall through to env vars
        console.error('SMTP DB config read failed, using env vars:', dbErr.message);
    }

    // No DB config -- use environment variables directly (Gmail / .env)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return {
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
        };
    }

    return null; // No config anywhere
};

const sendOtpEmail = async ({ to, otp, purpose }) => {
  if (!resend) {
    console.warn('Failed to send email: RESEND_API_KEY is not configured in process.env');
    return;
  }
  try {
    const data = await resend.emails.send({
      from: 'Alaga Monitoring System <onboarding@resend.dev>', // Use onboarding@resend.dev for testing if you haven't verified a custom domain yet
      to: [to],
      subject: 'Your OTP Code',
      html: `<p>Your verification code is: <strong>${otp}</strong></p>`
    });

    console.log('Email sent successfully:', data);
  } catch (error) {
    console.error('Failed to send email via Resend:', error);
    throw error;
  }
};

// ==========================================
// ROUTE 1: REGISTER
// [FIX] DB transaction covers only DB writes. The OTP email is sent AFTER
// the response is dispatched (non-blocking) to prevent Gmail SMTP latency
// (10-20s) from causing the Flutter client (15s timeout) to time out.
// The user + OTP rows are committed before any email attempt, so the user
// can always recover via /api/auth/resend-otp if the first email is lost.
// ==========================================
app.post(['/api/auth/register', '/api/auth/signup'], authLimiter, registerValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const firstError = errors.array()[0].msg;
        console.log("Validation Failed:", firstError);
        return res.status(400).json({ success: false, message: firstError, errors: errors.array() });
    }

    const client = await pool.connect();
    try {
        let { username, password, email, role, mobile_number, first_name, last_name, middle_initial } = req.body;
        console.log(`Registering user: ${email}`);

        const safeEmail = email.toLowerCase().trim();

        if (!username || username.trim() === '') {
            username = safeEmail.split('@')[0];
        }

        /* [OWASP A05] DNS MX validation to reject undeliverable email domains
        const domainHasMx = await validateEmailDomain(safeEmail);
        if (!domainHasMx) {
            return res.status(400).json({
                success: false,
                message: 'Email domain appears invalid or cannot receive mail.',
            });
        }
        */
        // [OWASP A05] Parameterized duplicate check
        const userCheck = await client.query(
            'SELECT * FROM users WHERE username = $1 OR email = $2',
            [username, safeEmail]
        );

        if (userCheck.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Username or Email already exists' });
        }

        // [OWASP A04] bcrypt with 12 salt rounds
        const salt = await bcrypt.genSalt(12);
        const password_hash = await bcrypt.hash(password, salt);

        // --- DB TRANSACTION: covers only writes, not network I/O ---
        await client.query('BEGIN');

        const newUser = await client.query(
            `INSERT INTO users (
                username, password_hash, email, role, 
                mobile_number, first_name, last_name, middle_initial, 
                account_status, is_verified, created_at
            ) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending_Review', FALSE, NOW()) 
             RETURNING user_id, username, role, email, account_status, is_verified`,
            [
                username,
                password_hash,
                safeEmail,
                role || 'caregiver',
                mobile_number,
                first_name,
                last_name,
                middle_initial || null
            ]
        );

        const createdUser = newUser.rows[0];
        const otp = generateOtp();
        const otpHash = hashOtp(otp);

        // Invalidate any prior unconsumed OTPs for this user
        await client.query(
            `UPDATE user_email_otps
             SET consumed_at = NOW()
             WHERE user_id = $1 AND purpose = 'REGISTER_VERIFY' AND consumed_at IS NULL`,
            [createdUser.user_id]
        );

        await client.query(
            `INSERT INTO user_email_otps (user_id, email, otp_hash, purpose, expires_at, last_sent_at)
             VALUES ($1, $2, $3, 'REGISTER_VERIFY', NOW() + INTERVAL '10 minutes', NOW())`,
            [createdUser.user_id, safeEmail, otpHash]
        );

        // [FIX] COMMIT before the email send so the DB write is not gated on SMTP.
        // The Flutter client receives its 201 immediately after this line.
        await client.query('COMMIT');
        client.release(); // Return connection to pool before the slow SMTP call

        console.log(`[REGISTER] User committed: ${safeEmail} (user_id: ${createdUser.user_id})`);

        // Respond to the Flutter client immediately -- do NOT await the email.
        res.status(201).json({
            success: true,
            message: 'Account created. OTP sent to email.',
            requiresOtp: true,
            otpPurpose: 'REGISTER_VERIFY',
            user_id: createdUser.user_id,
            email: createdUser.email,
        });

        // Fire-and-forget: send OTP email AFTER the response is dispatched.
        // If Gmail is slow or fails, the user can tap "Resend Code" on the OTP screen.
        // [OWASP A09] Log delivery failures server-side without exposing them to the client.
        sendOtpEmail({ to: safeEmail, otp, purpose: 'REGISTER_VERIFY' }).catch((emailErr) => {
            // Log the full error code so it appears in Render's log stream for diagnosis.
            // Common codes: ECONNREFUSED (port blocked), EAUTH (bad App Password), ETIMEDOUT (network).
            console.error(`[SMTP-FAIL] OTP delivery failed for ${safeEmail} | code=${emailErr.code || 'none'} | response=${emailErr.responseCode || 'none'} | msg=${emailErr.message}`);
        });

    } catch (err) {
        // Only DB errors reach here now -- email failures are caught above
        await client.query('ROLLBACK').catch(() => {});
        client.release();
        console.error('Registration DB Error:', err.message);
        // [OWASP A10] Generic error -- no stack trace to client
        res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
    }
});

app.post('/api/auth/verify-otp', authLimiter, async (req, res) => {
    try {
        const { user_id, email, otp, purpose } = req.body;
        const otpPurpose = purpose || 'REGISTER_VERIFY';
        if (!user_id || !email || !otp) {
            return res.status(400).json({ success: false, message: 'user_id, email, and otp are required.' });
        }

        const otpRecord = await pool.query(
            `SELECT otp_id, otp_hash, expires_at, attempts_count
             FROM user_email_otps
             WHERE user_id = $1 AND email = $2 AND purpose = $3 AND consumed_at IS NULL
             ORDER BY created_at DESC
             LIMIT 1`,
            [user_id, email.toLowerCase().trim(), otpPurpose]
        );

        if (otpRecord.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'No active OTP found. Please resend code.' });
        }

        const rec = otpRecord.rows[0];
        if (new Date(rec.expires_at).getTime() < Date.now()) {
            return res.status(400).json({ success: false, message: 'OTP has expired. Please resend code.' });
        }

        if ((rec.attempts_count || 0) >= 5) {
            return res.status(429).json({ success: false, message: 'Too many invalid OTP attempts. Resend a new code.' });
        }

        const submittedHash = hashOtp(otp.toString().trim());
        if (submittedHash !== rec.otp_hash) {
            await pool.query(
                `UPDATE user_email_otps SET attempts_count = attempts_count + 1 WHERE otp_id = $1`,
                [rec.otp_id]
            );
            return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
        }

        await pool.query('BEGIN');
        try {
            await pool.query(
                `UPDATE user_email_otps SET consumed_at = NOW() WHERE otp_id = $1`,
                [rec.otp_id]
            );
            await pool.query(
                `UPDATE users SET is_verified = TRUE, account_status = 'Active' WHERE user_id = $1`,
                [user_id]
            );
            const userRes = await pool.query(
                `SELECT user_id, username, email, role, first_name, account_status
                 FROM users WHERE user_id = $1`,
                [user_id]
            );
            await pool.query('COMMIT');

            const user = userRes.rows[0];
            const token = jwt.sign(
                { id: user.user_id, role: user.role },
                JWT_SECRET,
                { expiresIn: '8h' }
            );

            return res.json({
                success: true,
                message: 'Email verified successfully.',
                token,
                user: {
                    id: user.user_id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    name: user.first_name,
                    account_status: user.account_status,
                },
            });
        } catch (txErr) {
            await pool.query('ROLLBACK');
            throw txErr;
        }
    } catch (err) {
        console.error('Verify OTP Error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to verify OTP.' });
    }
});

app.post('/api/auth/resend-otp', authLimiter, async (req, res) => {
    try {
        const { user_id, email, purpose } = req.body;
        const otpPurpose = purpose || 'REGISTER_VERIFY';
        const safeEmail = (email || '').toLowerCase().trim();
        if (!user_id || !safeEmail) {
            return res.status(400).json({ success: false, message: 'user_id and email are required.' });
        }

        const userResult = await pool.query(
            'SELECT user_id, is_verified, email FROM users WHERE user_id = $1',
            [user_id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const user = userResult.rows[0];
        if (user.email !== safeEmail) {
            return res.status(400).json({ success: false, message: 'Email does not match user record.' });
        }
        if (user.is_verified) {
            return res.status(400).json({ success: false, message: 'Email is already verified.' });
        }

        const latestOtp = await pool.query(
            `SELECT last_sent_at
             FROM user_email_otps
             WHERE user_id = $1 AND purpose = $2
             ORDER BY created_at DESC
             LIMIT 1`,
            [user_id, otpPurpose]
        );
        if (latestOtp.rows.length > 0 && latestOtp.rows[0].last_sent_at) {
            const lastSent = new Date(latestOtp.rows[0].last_sent_at).getTime();
            if (Date.now() - lastSent < 60000) {
                return res.status(429).json({
                    success: false,
                    message: 'Please wait at least 60 seconds before requesting another OTP.',
                });
            }
        }

        const otp = generateOtp();
        const otpHash = hashOtp(otp);

        await pool.query(
            `UPDATE user_email_otps
             SET consumed_at = NOW()
             WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
            [user_id, otpPurpose]
        );

        await pool.query(
            `INSERT INTO user_email_otps (user_id, email, otp_hash, purpose, expires_at, last_sent_at)
             VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes', NOW())`,
            [user_id, safeEmail, otpHash, otpPurpose]
        );

        await sendOtpEmail({ to: safeEmail, otp, purpose: otpPurpose });
        return res.json({ success: true, message: 'OTP has been resent.' });
    } catch (err) {
        console.error('Resend OTP Error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to resend OTP.' });
    }
});

// ==========================================
// ROUTE 1C: FORGOT PASSWORD (Request OTP by Email Only)
// [INTEGRATION] Used by the mobile app's "Forgot Password" flow.
// Accepts only an email, looks up the user, generates an OTP with purpose
// 'PASSWORD_RESET', and returns the user_id for subsequent verify/reset calls.
// ==========================================
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email address is required.' });
        }

        const safeEmail = email.toLowerCase().trim();

        // [OWASP A05] Parameterized query
        const userResult = await pool.query(
            'SELECT user_id, email FROM users WHERE email = $1',
            [safeEmail]
        );

        if (userResult.rows.length === 0) {
            // [OWASP A10] Generic message to prevent user enumeration.
            return res.json({
                success: true,
                message: 'If an account with that email exists, a verification code has been sent.',
            });
        }

        const user = userResult.rows[0];

        // Rate-limit: check if an OTP was sent recently
        const latestOtp = await pool.query(
            `SELECT last_sent_at FROM user_email_otps
             WHERE user_id = $1 AND purpose = 'PASSWORD_RESET'
             ORDER BY created_at DESC LIMIT 1`,
            [user.user_id]
        );
        if (latestOtp.rows.length > 0 && latestOtp.rows[0].last_sent_at) {
            const lastSent = new Date(latestOtp.rows[0].last_sent_at).getTime();
            if (Date.now() - lastSent < 60000) {
                return res.status(429).json({
                    success: false,
                    message: 'Please wait at least 60 seconds before requesting another code.',
                });
            }
        }

        // Invalidate existing PASSWORD_RESET OTPs
        await pool.query(
            `UPDATE user_email_otps SET consumed_at = NOW()
             WHERE user_id = $1 AND purpose = 'PASSWORD_RESET' AND consumed_at IS NULL`,
            [user.user_id]
        );

        const otp = generateOtp();
        const otpHash = hashOtp(otp);

        await pool.query(
            `INSERT INTO user_email_otps (user_id, email, otp_hash, purpose, expires_at, last_sent_at)
             VALUES ($1, $2, $3, 'PASSWORD_RESET', NOW() + INTERVAL '10 minutes', NOW())`,
            [user.user_id, safeEmail, otpHash]
        );

        await sendOtpEmail({ to: safeEmail, otp, purpose: 'PASSWORD_RESET' });

        return res.json({
            success: true,
            message: 'If an account with that email exists, a verification code has been sent.',
            user_id: user.user_id,
            email: user.email,
        });
    } catch (err) {
        console.error('Forgot Password Error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to process request.' });
    }
});

// ==========================================
// ROUTE 1D: RESET PASSWORD (Verify OTP + Update Password)
// [OWASP A04] Password hashed with bcrypt, 12 salt rounds.
// ==========================================
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    try {
        const { user_id, otp, password } = req.body;

        if (!user_id || !otp || !password) {
            return res.status(400).json({ success: false, message: 'user_id, otp, and password are required.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
        }

        // 1. Verify the OTP
        const otpRecord = await pool.query(
            `SELECT otp_id, otp_hash, expires_at, attempts_count
             FROM user_email_otps
             WHERE user_id = $1 AND purpose = 'PASSWORD_RESET' AND consumed_at IS NULL
             ORDER BY created_at DESC LIMIT 1`,
            [user_id]
        );

        if (otpRecord.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'No active reset code found. Please request a new one.' });
        }

        const rec = otpRecord.rows[0];
        if (new Date(rec.expires_at).getTime() < Date.now()) {
            return res.status(400).json({ success: false, message: 'Reset code has expired. Please request a new one.' });
        }

        if ((rec.attempts_count || 0) >= 5) {
            return res.status(429).json({ success: false, message: 'Too many invalid attempts. Please request a new code.' });
        }

        const submittedHash = hashOtp(otp.toString().trim());
        if (submittedHash !== rec.otp_hash) {
            await pool.query(
                `UPDATE user_email_otps SET attempts_count = attempts_count + 1 WHERE otp_id = $1`,
                [rec.otp_id]
            );
            return res.status(400).json({ success: false, message: 'Invalid reset code.' });
        }

        // 2. OTP is valid -- hash the new password and update
        const salt = await bcrypt.genSalt(12);
        const password_hash = await bcrypt.hash(password, salt);

        await pool.query('BEGIN');
        try {
            await pool.query(`UPDATE user_email_otps SET consumed_at = NOW() WHERE otp_id = $1`, [rec.otp_id]);
            await pool.query(`UPDATE users SET password_hash = $1 WHERE user_id = $2`, [password_hash, user_id]);
            await pool.query('COMMIT');
            return res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
        } catch (txErr) {
            await pool.query('ROLLBACK');
            throw txErr;
        }
    } catch (err) {
        console.error('Reset Password Error:', err.message);
        return res.status(500).json({ success: false, message: 'Failed to reset password.' });
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

        // [OWASP A05] Parameterized query. We select only the columns needed
        // to satisfy the Minimum Necessary rule (HIPAA) while also fetching
        // profile_picture_url so the JWT session is fully hydrated on login —
        // avoiding the race condition where the dashboard avatar is blank until
        // the user visits the Profile tab.
        const result = await pool.query(
            `SELECT user_id, username, email, role, first_name,
                    account_status, is_locked, is_verified,
                    password_hash, profile_picture_url
             FROM users WHERE email = $1 OR username = $1`,
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

        if (!user.is_verified) {
            return res.status(403).json({
                success: false,
                requiresOtp: true,
                otpPurpose: 'REGISTER_VERIFY',
                user_id: user.user_id,
                email: user.email,
                message: 'Email not verified. Please verify OTP sent to your email.',
            });
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
                account_status: user.account_status,
                // [FIX] Include profile picture URL so the dashboard avatar
                // renders immediately after login without a separate API call.
                profilePictureUrl: user.profile_picture_url || null,
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
// SMTP HEALTH CHECK (Admin-only diagnostic)
// [OWASP A09] Returns which SMTP fields are set WITHOUT exposing credential values.
// Also attempts transporter.verify() to expose the real network/auth error.
// ==========================================
app.get('/api/admin/smtp-health', verifyToken, async (req, res) => {
    const adminRoles = ['system_admin', 'admin', 'sysadmin'];
    if (!adminRoles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Restricted to System Administrators.' });
    }

    const smtp = await loadSmtpConfig().catch(() => null);

    let connectionError = null;
    let connectionOk = false;

    if (smtp && smtp.host && smtp.user && smtp.pass) {
        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.port,
            secure: smtp.secure,
            auth: { user: smtp.user, pass: smtp.pass },
        });
        try {
            // verify() opens a real TCP connection to the SMTP server.
            // If Render blocks the port, this will throw ECONNREFUSED or ETIMEDOUT.
            // If the App Password is wrong, this throws AuthError.
            await transporter.verify();
            connectionOk = true;
        } catch (verifyErr) {
            // [OWASP A09] Safe to expose to admins — no PHI or credential values in error code.
            connectionError = {
                code: verifyErr.code || null,
                message: verifyErr.message || 'Unknown error',
                responseCode: verifyErr.responseCode || null,
            };
        }
    }

    return res.json({
        success: true,
        smtp_configured: !!smtp,
        connection_ok: connectionOk,
        connection_error: connectionError,
        fields: smtp ? {
            host_preview: smtp.host || null,
            port: smtp.port,
            secure: smtp.secure,
            user_preview: smtp.user ? smtp.user.replace(/(.{2}).*(@.*)/, '$1***$2') : null,
            has_pass: !!smtp.pass,
        } : null,
        source_env_vars: {
            SMTP_HOST: !!process.env.SMTP_HOST,
            SMTP_PORT: !!process.env.SMTP_PORT,
            SMTP_USER: !!process.env.SMTP_USER,
            SMTP_PASS: !!process.env.SMTP_PASS,
            SMTP_FROM: !!process.env.SMTP_FROM,
        },
    });
});

// ==========================================
// SMTP TEST SEND (Admin-only — synchronous send so error is visible)
// POST body: { to: 'target@email.com' }
// Returns the exact nodemailer/network error to the caller.
// [OWASP A09] Protected by JWT — not exposed to unauthenticated users.
// ==========================================
app.post('/api/admin/smtp-test-send', verifyToken, async (req, res) => {
    const adminRoles = ['system_admin', 'admin', 'sysadmin'];
    if (!adminRoles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Restricted to System Administrators.' });
    }

    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, message: '"to" email address is required.' });

    const smtp = await loadSmtpConfig().catch(() => null);
    if (!smtp || !smtp.host || !smtp.user || !smtp.pass) {
        return res.status(500).json({ success: false, message: 'SMTP is not configured.' });
    }

    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
    });

    try {
        const info = await transporter.sendMail({
            from: smtp.from,
            to,
            subject: 'ALAGA SMTP Test',
            text: 'This is a test email from the Alaga backend diagnostic endpoint.',
        });
        return res.json({
            success: true,
            message: 'Test email sent successfully.',
            messageId: info.messageId,
            response: info.response,
        });
    } catch (err) {
        // Return the full error details so the admin can see exactly what failed.
        return res.status(500).json({
            success: false,
            message: 'SMTP send failed.',
            error: {
                code: err.code || null,
                message: err.message || 'Unknown error',
                responseCode: err.responseCode || null,
                command: err.command || null,
            },
        });
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

// Endpoint to receive data from ESP32s
app.post('/api/device/data', async (req, res) => {
    const { device_id, heart_rate, temperature, spo2, moisture } = req.body;

    try {
        // 1. Verify the device identity in your database
        const deviceCheck = await pool.query(
            'SELECT assigned_patient_id FROM device_whitelist WHERE serial_number = $1 AND status = $2', 
            [device_id, 'ACTIVE']
        );

        if (deviceCheck.rows.length === 0) {
            return res.status(403).send("Unauthorized device.");
        }

        const patientId = deviceCheck.rows[0].assigned_patient_id;

        // 2. Insert the readings into the database
        await pool.query(
            `INSERT INTO sensor_readings (patient_id, heart_rate, temperature, spo2, moisture_value, recorded_at) 
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [patientId, heart_rate || 0, temperature || 0, spo2 || 0, moisture || 0]
        );

        res.status(200).send("Data recorded successfully.");
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error.");
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

app.use('/api/schedules', scheduleRoutes);
// Alerts, Audit, and Triage Routes
const alertsRoutes = require('./routes/alertsRoutes');
app.use('/api/alerts', alertsRoutes);

// ==========================================
// ROUTE 7: SENSOR DATA + AI INTEGRATION
// ==========================================
// [OWASP A07] Device authentication via per-device token hashes (device_whitelist table)
// [OWASP A01] IDOR protection on all JWT-authenticated endpoints
// [HIPAA]     Every reading is logged to access_logs and sensor_readings
// URL Prefix: http://localhost:3000/api/sensor/
const sensorRoutes = require('./routes/sensorRoutes');
app.use('/api/sensor', sensorRoutes);

// ==========================================
// ERROR HANDLERS (must be AFTER all route registrations)
// Express only invokes 4-parameter middleware as error handlers.
// ==========================================

// [FIX] Handle JSON Parse Errors (e.g. malformed request body)
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('Bad JSON Body:', err.message);
        return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    }
    next(err);
});

// [OWASP A10] Generic catch-all error handler -- prevent stack trace leakage
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.message);
    res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

// --- Start Server ---
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`ALAGA Server running on http://${HOST}:${PORT}`);
    console.log(`Accepting local network connections for mobile testing.`);
});