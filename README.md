# 🌿 EcoCollect: Smart Waste Collection & Recycling Platform

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-emerald)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-blue)](https://expressjs.com)
[![Database](https://img.shields.io/badge/Database-SQLite3-lightgrey)](https://www.sqlite.org)
[![Docker](https://img.shields.io/badge/Docker-Cloud%20Run%20Ready-2496ED)](https://cloud.google.com/run)
[![License](https://img.shields.io/badge/License-MIT-green)](#)

> **EcoCollect** is a full-stack, zero-configuration MVP created for hackathons. It bridges the gap between residents seeking proper waste categorization & pickup scheduling, and collection agencies needing live dispatch tracking and collection metrics.

---

## 💡 Problem & Solution

* **The Problem:** Residents frequently struggle to categorize waste (Organic vs. Recyclable vs. E-Waste vs. Hazardous), miss pickup windows, and lack visibility into collection status. Meanwhile, waste management agencies struggle to monitor, group, and route incoming collection requests efficiently.
* **The Solution:** **EcoCollect** provides an intuitive single-page portal for residents to submit categorized pickup requests, track live collection progress with a unique tracking code (e.g. `ECO-8392`), calculate personal CO₂ offsets, and gives collection agencies a real-time admin dispatch center with one-click status transitions and metrics.

---

## 🛠️ Architecture & Tech Stack

```
   ┌───────────────────────────────────────────────────────────┐
   │                   Single-Page Frontend                    │
   │  HTML5 + Tailwind CSS (CDN) + Vanilla JS (Single-Page App) │
   └─────────────────────────────┬─────────────────────────────┘
                                 │ HTTP REST API
   ┌─────────────────────────────▼─────────────────────────────┐
   │                   Express.js Backend                      │
   │           RESTful API / Static File Server                │
   └─────────────────────────────┬─────────────────────────────┘
                                 │ SQL Queries
   ┌─────────────────────────────▼─────────────────────────────┐
   │                  SQLite3 Persistence                      │
   │    Zero-config file-based storage (data/ecocollect.db)    │
   └───────────────────────────────────────────────────────────┘
```

* **Frontend:** HTML5, Tailwind CSS via CDN, FontAwesome Icons, Vanilla JavaScript (SPA architecture with micro-animations and zero dependencies).
* **Backend:** Node.js with Express.js REST API.
* **Database:** SQLite (`sqlite3`) with automatic table creation & initial seed data.
* **Containerization:** Production-ready Dockerfile optimized for Google Cloud Run (listening on `process.env.PORT || 8080`).

---

## ✨ Key Features

### 1. Resident Portal & Request Submission
* **Visual Category Cards:** Organic 🥬, Recyclables ♻️, E-Waste 🔌, and Hazardous ⚠️ with instant disposal tips and accepted/prohibited item guidance.
* **Location & Contact Details:** Street address, contact info, and landmarks.
* **Volume Estimation:** Interactive size pills (`Small Box`, `1-2 Bags`, `3-5 Bags`, `Bulk/Heavy`).
* **Pickup Scheduling:** Select pickup date (validated from today onwards) and preferred time slots (Morning, Afternoon, Evening).
* **Tracking ID Generator:** Generates a unique tracking ID (e.g. `ECO-8392`) upon submission.

### 2. Live Request Tracking Stepper
* **Interactive Timeline:** Track live status: `Submitted` ➡️ `Approved` ➡️ `Scheduled` ➡️ `Completed` (or `Cancelled`).
* **LocalStorage Memory:** Automatically saves recent tracking IDs for quick one-click lookup.
* **Cancellation Support:** Residents can cancel pending requests prior to dispatch.

### 3. Recycling & Educational Guide
* **Interactive Category Breakdown:** View accepted/prohibited items and expert disposal tips.
* **CO₂ Offset Calculator:** Interactive slider calculating annual avoided CO₂ emissions and tree equivalents based on weekly household recycling volume.

### 4. Admin Dispatch Center
* **Metric Cards:** Real-time count of total requests, pending, scheduled, completed, and estimated diverted landfill weight (kg).
* **Data Management Table:** Clean responsive table showing request date, resident, address, category, and scheduled window.
* **One-Click Actions:** Instant status transitions (`Pending` ➡️ `Approved` ➡️ `Scheduled` ➡️ `Completed`).
* **Filtering & Search:** Real-time search by ID, resident name, or address, plus category and status filters.
* **Internal Dispatch Notes:** Attach collector notes (e.g., driver assignment, gate codes).
* **Hackathon Demo Seeder:** One-click button to populate sample requests for instant presentation.

---

## 📂 File Structure

```
ecoplat-waste-management/
├── server.js              # Express backend API & SQLite database setup
├── public/
│   ├── index.html         # Main single-page interface
│   ├── app.js             # Frontend logic, API calls, DOM manipulation
│   └── style.css          # Custom tweaks & Tailwind extensions
├── data/
│   └── ecocollect.db      # SQLite persistent database (created automatically)
├── package.json           # Dependencies and start scripts
├── Dockerfile             # Container configuration for Google Cloud Run
└── README.md              # Comprehensive documentation
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
* Node.js (v18 or higher)
* npm

### Step 1: Install Dependencies
```bash
cd ecoplat-waste-management
npm install
```

### Step 2: Start the Application
```bash
npm start
```

### Step 3: Open in Browser
Navigate to `http://localhost:8080` in your web browser.

> 💡 **Hackathon Tip:** Click the **"Seed Mock Data"** button in the top navigation bar to instantly populate sample pickup requests into SQLite!

---

## 📡 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check |
| `GET` | `/api/categories` | Metadata & disposal tips for all waste categories |
| `POST` | `/api/requests` | Submit a new pickup request (Generates `ECO-XXXX` ID) |
| `GET` | `/api/requests` | Fetch requests (Supports `?category=`, `?status=`, `?search=`) |
| `GET` | `/api/requests/:trackingId` | Retrieve details for a specific tracking ID |
| `PATCH` | `/api/requests/:trackingId/status` | Update status (`Pending`, `Approved`, `Scheduled`, `Completed`, `Cancelled`) |
| `DELETE` | `/api/requests/:trackingId` | Delete a request |
| `GET` | `/api/stats` | Aggregate collection statistics & eco impact metrics |
| `POST` | `/api/seed` | Reset & re-seed mock demo data |

---

## 🐳 Docker Containerization

To test building and running the container locally:

```bash
# Build Docker image
docker build -t ecocollect:latest .

# Run container on port 8080
docker run -p 8080:8080 ecocollect:latest
```

---

## ☁️ Deployment to Google Cloud Run

EcoCollect is pre-configured out-of-the-box for **Google Cloud Run**.

### Step 1: Set Google Cloud Project
```bash
gcloud config set project YOUR_PROJECT_ID
```

### Step 2: Build & Deploy directly from source
```bash
gcloud run deploy ecocollect \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

Cloud Run will build the container image using the `Dockerfile`, deploy it to a serverless URL, and expose port 8080 automatically.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
