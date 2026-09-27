require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// ---------------------------------------------------------------------------
// MySQL Connection Pool
// ---------------------------------------------------------------------------
// Production: set DATABASE_URL as a full connection string, e.g.
//   mysql://user:pass@host:3306/ecocollect
// Local dev: set individual MYSQL_* env vars or rely on the defaults below.
// ---------------------------------------------------------------------------

function buildPoolConfig() {
    if (process.env.DATABASE_URL) {
        return {
            uri: process.env.DATABASE_URL,
            waitForConnections: true,
            connectionLimit: 10
        };
    }

    const config = {
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'ecocollect',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

    if (process.env.MYSQL_SSL_CA) {
        config.ssl = {
            ca: fs.readFileSync(process.env.MYSQL_SSL_CA),
            rejectUnauthorized: true
        };
    }

    return config;
}

const pool = mysql.createPool(buildPoolConfig());

// ---------------------------------------------------------------------------
// Schema Initialization
// ---------------------------------------------------------------------------
async function initDb() {
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS requests (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                tracking_id VARCHAR(20)  UNIQUE NOT NULL,
                category    VARCHAR(100) NOT NULL,
                name        VARCHAR(255) NOT NULL,
                phone       VARCHAR(50)  NOT NULL,
                address     TEXT         NOT NULL,
                \`date\`    VARCHAR(50)  NOT NULL,
                slot        VARCHAR(100) NOT NULL,
                notes       TEXT,
                status      VARCHAR(50)  DEFAULT 'Pending',
                created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create index for fast tracking ID lookups — swallow error if already exists
        // (MySQL 5.7 on XAMPP doesn't support CREATE INDEX IF NOT EXISTS)
        await conn.query(
            `CREATE INDEX idx_tracking ON requests (tracking_id)`
        ).catch(() => { /* index already exists, that's fine */ });

        console.log('MySQL database initialized successfully.');
    } catch (err) {
        console.error('Database initialization error:', err.message);
        process.exit(1);
    } finally {
        conn.release();
    }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// REST API Endpoints
// ---------------------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'EcoCollect API Operational', timestamp: new Date() });
});

// 1. Submit a new waste collection request
app.post('/api/requests', async (req, res) => {
    const { category, name, phone, address, date, slot, notes } = req.body;

    if (!category || !name || !phone || !address || !date || !slot) {
        return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    // Generate a unique tracking ID, e.g. ECO-7482
    const tracking_id = 'ECO-' + Math.floor(1000 + Math.random() * 9000);

    try {
        const [result] = await pool.query(
            `INSERT INTO requests
                (tracking_id, category, name, phone, address, \`date\`, slot, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
            [tracking_id, category, name, phone, address, date, slot, notes || '']
        );

        res.json({
            message: 'Request submitted successfully!',
            tracking_id,
            id: result.insertId,
        });
    } catch (err) {
        console.error('POST /api/requests error:', err.message);
        res.status(500).json({ error: 'Failed to submit request. Please try again.' });
    }
});

// 2. Get all requests (Admin Dashboard) — most recent first
app.get('/api/requests', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM requests ORDER BY created_at DESC`
        );
        res.json({ requests: rows });
    } catch (err) {
        console.error('GET /api/requests error:', err.message);
        res.status(500).json({ error: 'Failed to fetch requests.' });
    }
});

// 3. Track a specific request by tracking ID
app.get('/api/requests/:trackingId', async (req, res) => {
    const trackingId = req.params.trackingId.toUpperCase();
    try {
        const [rows] = await pool.query(
            `SELECT * FROM requests WHERE tracking_id = ?`,
            [trackingId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Tracking ID not found.' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('GET /api/requests/:trackingId error:', err.message);
        res.status(500).json({ error: 'Failed to fetch request.' });
    }
});

// 4. Update request status (Admin action)
app.patch('/api/requests/:id/status', async (req, res) => {
    const { status } = req.body;
    const id = parseInt(req.params.id, 10);

    const validStatuses = ['Pending', 'Scheduled', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value.' });
    }

    try {
        const [result] = await pool.query(
            `UPDATE requests SET status = ? WHERE id = ?`,
            [status, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Request not found.' });
        }
        res.json({ message: 'Status updated successfully.' });
    } catch (err) {
        console.error('PATCH /api/requests/:id/status error:', err.message);
        res.status(500).json({ error: 'Failed to update status.' });
    }
});

// 5. Aggregate stats for Admin Dashboard
app.get('/api/stats', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                SUM(status = 'Pending')   AS pending,
                SUM(status = 'Scheduled') AS scheduled,
                SUM(status = 'Completed') AS completed,
                SUM(status = 'Cancelled') AS cancelled
            FROM requests
        `);
        const s = rows[0];
        res.json({
            total: parseInt(s.total || 0),
            pending: parseInt(s.pending || 0),
            scheduled: parseInt(s.scheduled || 0),
            completed: parseInt(s.completed || 0),
            cancelled: parseInt(s.cancelled || 0),
            diverted_kg: parseInt(s.completed || 0) * 15
        });
    } catch (err) {
        console.error('GET /api/stats error:', err.message);
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

// ---------------------------------------------------------------------------
// SPA Fallback
// ---------------------------------------------------------------------------
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Boot: initialise schema then start listening
// ---------------------------------------------------------------------------
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`EcoCollect server running on port ${PORT}`);
    });
});
