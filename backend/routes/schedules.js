const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM schedules ORDER BY scheduled_at ASC');
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

router.post('/', async (req, res) => {
    const { patient_name, event_type, custom_event_name, is_recurring, recurrence_interval, scheduled_at, status } = req.body;

    if (!patient_name || !event_type || !scheduled_at) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    try {
        const query = `
            INSERT INTO schedules (patient_name, event_type, custom_event_name, is_recurring, recurrence_interval, scheduled_at, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const values = [
            patient_name,
            event_type,
            custom_event_name || null,
            is_recurring || false,
            recurrence_interval || null,
            scheduled_at,
            status || 'Pending'
        ];

        const newSchedule = await pool.query(query, values);
        res.json({ status: 'success', message: 'Schedule saved successfully', data: newSchedule.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

router.put('/:id/acknowledge', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("UPDATE schedules SET status = 'Completed' WHERE schedule_id = $1 RETURNING *", [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Schedule not found' });
        }
        res.json({ status: 'success', message: 'Schedule acknowledged and updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { patient_name, event_type, custom_event_name, is_recurring, recurrence_interval, scheduled_at, status } = req.body;

    if (!patient_name || !event_type || !scheduled_at) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    try {
        const query = `
            UPDATE schedules 
            SET patient_name = $1, 
                event_type = $2, 
                custom_event_name = $3, 
                is_recurring = $4, 
                recurrence_interval = $5, 
                scheduled_at = $6, 
                status = $7
            WHERE schedule_id = $8
            RETURNING *;
        `;
        const values = [
            patient_name,
            event_type,
            custom_event_name || null,
            is_recurring || false,
            recurrence_interval || null,
            scheduled_at,
            status || 'Pending',
            id
        ];

        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Schedule not found' });
        }
        res.json({ status: 'success', message: 'Schedule updated successfully', data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM schedules WHERE schedule_id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Schedule not found' });
        }
        res.json({ status: 'success', message: 'Schedule deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

module.exports = router;