const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// [HIPAA & OWASP A04] Profile picture upload configuration
// Ensure files are securely stored on the server and verified for appropriate file types
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', 'uploads', 'profiles');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Obfuscate filename to prevent enumeration (OWASP A01 mitigation)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB Limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Error: File upload only supports images (JPEG, JPG, PNG)!'));
    }
});

// ==========================================
// ROUTE: GET /api/user/profile
// Description: Fetch current user's profile details
// ==========================================
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // [BUG FIX] notification_preferences does NOT exist on the users table.
        // It lives in profiles_caregivers (for caregiver/parent roles) and
        // profiles_medical_staff does not have it at all.
        // We LEFT JOIN to profiles_caregivers so the column resolves correctly
        // for all roles: caregivers get their saved prefs, all others get NULL.
        // [OWASP A05] Parameterized query prevents SQL Injection.
        const result = await pool.query(
            `SELECT
                u.username,
                u.email,
                u.mobile_number,
                u.profile_picture_url,
                u.first_name,
                u.last_name,
                u.role,
                pc.notification_preferences
             FROM users u
             LEFT JOIN profiles_caregivers pc ON pc.user_id = u.user_id
             WHERE u.user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.json({ success: true, profile: result.rows[0] });
    } catch (err) {
        // [OWASP A09] Log the full error server-side for diagnosis.
        // [OWASP A10] Generic message to the client — no stack trace exposed.
        console.error("Fetch Profile Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
    }
});

// ==========================================
// ROUTE: PUT /api/user/profile
// Description: Update user profile including picture
// ==========================================
router.put('/', verifyToken, upload.single('profile_picture'), async (req, res) => {
    try {
        const userId = req.user.id;
        const { username, mobile_number, password } = req.body;

        // Start transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Check if username is already taken by another user
            if (username) {
                const nameCheck = await client.query(
                    'SELECT user_id FROM users WHERE username = $1 AND user_id != $2',
                    [username, userId]
                );
                if (nameCheck.rows.length > 0) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({ success: false, message: 'Username is already taken' });
                }
            }

            // 2. Build dynamic update query to adhere to DPA Data Minimization (only update what is passed)
            const updates = [];
            const values = [];
            let paramIndex = 1;

            if (username !== undefined) {
                updates.push(`username = $${paramIndex++}`);
                values.push(username);
            }

            if (mobile_number !== undefined) {
                updates.push(`mobile_number = $${paramIndex++}`);
                values.push(mobile_number);
            }

            // [INTEGRATION] notification_preferences is a PostgreSQL TEXT[] column.
            // The frontend sends an array of enabled preference key strings.
            // [DPA] Storing only enabled keys minimizes data surface on disk.
            if (req.body.notification_preferences !== undefined) {
                const prefs = req.body.notification_preferences;
                if (!Array.isArray(prefs)) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: 'notification_preferences must be an array.' });
                }
                updates.push(`notification_preferences = $${paramIndex++}::text[]`);
                values.push(prefs);
            }

            // [OWASP A07] Verify current password before allowing a password change.
            // Without this check, a stolen JWT could be used to silently change the password
            // and permanently lock out the legitimate account owner.
            // [HIPAA] This constitutes a PHI access-control boundary — a failed check is
            // treated as an unauthorized modification attempt.
            if (password && password.trim() !== '') {
                if (password.length < 8) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
                }

                const { current_password } = req.body;
                if (!current_password) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, message: 'Current password is required to set a new password.' });
                }

                // Fetch the stored hash for comparison
                const hashResult = await client.query(
                    'SELECT password_hash FROM users WHERE user_id = $1',
                    [userId]
                );
                if (hashResult.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, message: 'User not found.' });
                }

                // [OWASP A04] bcrypt.compare() is timing-safe — prevents timing attacks.
                const isCurrentPasswordCorrect = await bcrypt.compare(
                    current_password,
                    hashResult.rows[0].password_hash
                );
                if (!isCurrentPasswordCorrect) {
                    await client.query('ROLLBACK');
                    // [OWASP A10] Generic message — does not reveal whether the account exists.
                    return res.status(403).json({ success: false, message: 'Current password is incorrect.' });
                }

                const salt = await bcrypt.genSalt(12);
                const password_hash = await bcrypt.hash(password, salt);
                updates.push(`password_hash = $${paramIndex++}`);
                values.push(password_hash);
            }

            // Add Profile Picture Path
            if (req.file) {
                // Ensure proper URL structure for the frontend
                const fileUrl = `/uploads/profiles/${req.file.filename}`;
                updates.push(`profile_picture_url = $${paramIndex++}`);
                values.push(fileUrl);
            }

            // Execute update if there are fields to update
            if (updates.length > 0) {
                values.push(userId); // Add userId as last param
                const queryText = `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramIndex} RETURNING username, email, mobile_number, profile_picture_url`;
                
                const updatedUser = await client.query(queryText, values);
                
                await client.query('COMMIT');
                
                return res.json({ 
                    success: true, 
                    message: "Profile updated successfully.",
                    profile: updatedUser.rows[0]
                });
            } else {
                await client.query('ROLLBACK');
                return res.json({ success: true, message: "No changes made to profile." });
            }
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error("Profile Update Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

module.exports = router;
