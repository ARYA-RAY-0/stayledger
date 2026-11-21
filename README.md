# StayLedger

**Multi-Property Holiday Club & Vacation Ownership Operations Console**

StayLedger is a full-stack points-based Property Management System (PMS) and double-entry credit ledger built for multi-resort holiday clubs. It pairs a zoneless **Angular** three-pane operations console with an **Express / TypeScript** API and **PostgreSQL** concurrency and financial integrity constraints.

---

## Core Architecture

- **Database-Level Concurrency Protection (PostgreSQL btree_gist):** Enforces exclusion constraints over `(unit_id WITH =, daterange(check_in, check_out, '[)') WITH &&)` on active reservations so overlapping bookings are atomically rejected (`409 Conflict`) at the storage layer.
- **Self-Reconciling Double-Entry Credit Ledger:** Every booking debit and cancellation refund executes inside an ACID transaction (`BEGIN ... COMMIT / ROLLBACK`), updating `members.credits_balance` and appending an immutable audit row to `credit_ledger`. Executive telemetry continuously verifies `credits_balance == SUM(delta)` across all members.
- **Single-Pass CTE Operational Telemetry:** Computes Active Occupancy %, Credits Redeemed per Available Unit (PtPAU), Unredeemed Member Credit Liability, Average Length of Stay (ALOS), and Season Yield (`OFF_PEAK` 0.75x, `MID` 1.00x, `PEAK` 1.50x) in a single PostgreSQL query.
- **Three-Pane Resort Operations UI:** Light-mode operations workspace featuring a portfolio scope rail, visual unit stay schedule, live credit quote calculator, and a right-hand Member & Stay 360 Inspector.

---

## Tech Stack

- **Frontend:** Angular (Standalone Components, Signals, Zoneless Change Detection, Reactive Forms)
- **Backend:** Node.js, Express, TypeScript, `pg` connection pooling, Helmet, CORS
- **Database:** PostgreSQL 16 (`btree_gist` extension, transactional stored constraints, analytical CTE views)
- **Infrastructure:** Docker Compose

---

## Local Setup

### 1. Start PostgreSQL & Seed Schema
```ash
docker compose up -d
```

### 2. Run the Backend API (http://localhost:4000/api)
```ash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 3. Run the Angular Operations Console (http://localhost:4200)
```ash
cd frontend
npm install
npm start
```

---

## Key API Endpoints

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/analytics/overview` | Portfolio KPIs, property breakdown, season yield & ledger reconciliation proof |
| `GET` | `/api/units` | List accommodation units with optional `propertyId` and `status` filters |
| `PATCH` | `/api/units/:id/status` | Transition unit readiness (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`) |
| `GET` | `/api/members` | Retrieve club members, tiers, and current credit balances |
| `GET` | `/api/reservations` | List reservations joined with property, unit, member, and season metadata |
| `POST` | `/api/reservations` | Atomically validate dates/credits, debit wallet, post ledger entry & lock unit dates |
| `PATCH` | `/api/reservations/:id/cancel` | Cancel reservation and atomically post a full credit refund entry |