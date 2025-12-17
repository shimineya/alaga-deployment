const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const pool = require('./db'); 

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send('Alaga Backend System is Running 🚀');
});

// 1. REGISTER (Sign Up)
app.post('/register', async (req, res) => {
  try {
    const { username, password, email, role } = req.body;
    
    // Check if user exists
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Encrypt Password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert into DB
    const newUser = await pool.query(
      `INSERT INTO users (username, password_hash, email, role) 
       VALUES ($1, $2, $3, $4) RETURNING user_id, username, role`,
      [username, password_hash, email, role]
    );

    res.json({ success: true, user: newUser.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// 2. LOGIN (Sign In)
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // A. Check if user exists
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid Credentials" });
    }

    const user = result.rows[0];

    // B. Check Password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Invalid Credentials" });
    }

    // C. Success
    res.json({ 
        success: true, 
        message: "Login Successful", 
        user: { id: user.user_id, username: user.username, role: user.role } 
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// 3. SENSOR DATA INGESTION (New Route for ESP32)
// This receives Heart Rate, SpO2, Temp, and Moisture
app.post('/api/sensors', async (req, res) => {
    try {
        // 1. Deconstruct the data sent by the ESP32 or Simulation
        const { patient_id, heart_rate, spo2, temperature, moisture_value } = req.body;

        // 2. Basic Validation
        if (!patient_id) {
            return res.status(400).json({ error: "Patient ID is required" });
        }

        // 3. Insert into the 'sensor_readings' table
        // Note: We do not need to send 'recorded_at', Postgres handles that automatically
        const newReading = await pool.query(
            `INSERT INTO sensor_readings (patient_id, heart_rate, spo2, temperature, moisture_value) 
             VALUES ($1, $2, $3, $4, $5) RETURNING reading_id, recorded_at`,
            [patient_id, heart_rate, spo2, temperature, moisture_value]
        );

        // Success Response
        res.json({ 
            success: true, 
            message: "Data received", 
            data: newReading.rows[0] 
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});