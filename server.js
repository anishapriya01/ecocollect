require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 8080;

// ---------------------------------------------------------------------------
// In-Memory Storage
// ---------------------------------------------------------------------------
// TiDB/MySQL completely removed.
// Suitable for MVP/demo deployment.
// ---------------------------------------------------------------------------

let requests = [];
let nextId = 1;

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
    res.json({
        status: 'ok',
        message: 'EcoCollect API Operational',
        timestamp: new Date()
    });
});

// ---------------------------------------------------------------------------
// 1. Submit a new waste collection request
// ---------------------------------------------------------------------------

app.post('/api/requests', (req, res) => {
    const {
        category,
        name,
        phone,
        address,
        date,
        slot,
        notes
    } = req.body;

    if (!category || !name || !phone || !address || !date || !slot) {
        return res.status(400).json({
            error: 'Please fill in all required fields.'
        });
    }

    // Generate unique tracking ID
    let tracking_id;

    do {
        tracking_id =
            'ECO-' + Math.floor(1000 + Math.random() * 9000);
    } while (
        requests.some(
            request => request.tracking_id === tracking_id
        )
    );

    const request = {
        id: nextId++,
        tracking_id,
        category,
        name,
        phone,
        address,
        date,
        slot,
        notes: notes || '',
        status: 'Pending',
        created_at: new Date().toISOString()
    };

    requests.push(request);

    res.json({
        message: 'Request submitted successfully!',
        tracking_id,
        id: request.id
    });
});

// ---------------------------------------------------------------------------
// 2. Get all requests
// Admin Dashboard — most recent first
// ---------------------------------------------------------------------------

app.get('/api/requests', (req, res) => {
    const sortedRequests = [...requests].sort(
        (a, b) =>
            new Date(b.created_at) -
            new Date(a.created_at)
    );

    res.json({
        requests: sortedRequests
    });
});

// ---------------------------------------------------------------------------
// 3. Track a specific request by tracking ID
// ---------------------------------------------------------------------------

app.get('/api/requests/:trackingId', (req, res) => {
    const trackingId =
        req.params.trackingId.toUpperCase();

    const request = requests.find(
        item =>
            item.tracking_id.toUpperCase() === trackingId
    );

    if (!request) {
        return res.status(404).json({
            error: 'Tracking ID not found.'
        });
    }

    res.json(request);
});

// ---------------------------------------------------------------------------
// 4. Update request status
// Admin action
// ---------------------------------------------------------------------------

app.patch('/api/requests/:id/status', (req, res) => {
    const { status } = req.body;
    const id = parseInt(req.params.id, 10);

    const validStatuses = [
        'Pending',
        'Scheduled',
        'Completed',
        'Cancelled'
    ];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            error: 'Invalid status value.'
        });
    }

    const request = requests.find(
        item => item.id === id
    );

    if (!request) {
        return res.status(404).json({
            error: 'Request not found.'
        });
    }

    request.status = status;

    res.json({
        message: 'Status updated successfully.'
    });
});

// ---------------------------------------------------------------------------
// 5. Aggregate stats for Admin Dashboard
// ---------------------------------------------------------------------------

app.get('/api/stats', (req, res) => {
    const total = requests.length;

    const pending = requests.filter(
        request => request.status === 'Pending'
    ).length;

    const scheduled = requests.filter(
        request => request.status === 'Scheduled'
    ).length;

    const completed = requests.filter(
        request => request.status === 'Completed'
    ).length;

    const cancelled = requests.filter(
        request => request.status === 'Cancelled'
    ).length;

    res.json({
        total,
        pending,
        scheduled,
        completed,
        cancelled,

        // Existing EcoCollect calculation
        diverted_kg: completed * 15
    });
});

// ---------------------------------------------------------------------------
// SPA Fallback
// ---------------------------------------------------------------------------

app.get('*', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'index.html')
    );
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
    console.log(
        `EcoCollect server running on port ${PORT}`
    );
});