-- Enable btree_gist for database-level exclusion constraints on date ranges
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Properties (Resorts / Lodges)
CREATE TABLE properties (
    property_id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    region VARCHAR(80) NOT NULL,
    province VARCHAR(80) NOT NULL,
    total_capacity INT NOT NULL CHECK (total_capacity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Accommodation Units
CREATE TABLE units (
    unit_id SERIAL PRIMARY KEY,
    property_id INT NOT NULL REFERENCES properties(property_id) ON DELETE CASCADE,
    unit_code VARCHAR(20) NOT NULL,
    unit_type VARCHAR(60) NOT NULL,
    sleeps INT NOT NULL CHECK (sleeps > 0),
    base_credits_per_night INT NOT NULL CHECK (base_credits_per_night > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE')),
    UNIQUE (property_id, unit_code)
);

-- 3. Seasonal Yield Multipliers
CREATE TABLE season_bands (
    season_id SERIAL PRIMARY KEY,
    season_name VARCHAR(30) NOT NULL UNIQUE
        CHECK (season_name IN ('PEAK', 'MID', 'OFF_PEAK')),
    multiplier NUMERIC(4, 2) NOT NULL CHECK (multiplier > 0),
    description VARCHAR(150) NOT NULL
);

-- 4. Club Members
CREATE TABLE members (
    member_id SERIAL PRIMARY KEY,
    member_no VARCHAR(25) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    tier VARCHAR(20) NOT NULL DEFAULT 'SILVER'
        CHECK (tier IN ('SILVER', 'GOLD', 'PLATINUM')),
    credits_balance INT NOT NULL DEFAULT 0 CHECK (credits_balance >= 0),
    credits_expiry_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Reservations (Database-locked against overlapping dates per active unit)
CREATE TABLE reservations (
    reservation_id SERIAL PRIMARY KEY,
    reference_code VARCHAR(30) NOT NULL UNIQUE,
    unit_id INT NOT NULL REFERENCES units(unit_id) ON DELETE RESTRICT,
    member_id INT NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
    season_id INT NOT NULL REFERENCES season_bands(season_id),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    nights INT GENERATED ALWAYS AS (check_out - check_in) STORED,
    credits_charged INT NOT NULL CHECK (credits_charged > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED'
        CHECK (status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (check_out > check_in),
    CONSTRAINT no_overlapping_active_bookings EXCLUDE USING GIST (
        unit_id WITH =,
        daterange(check_in, check_out, '[)') WITH &&
    ) WHERE (status IN ('CONFIRMED', 'CHECKED_IN'))
);

-- 6. Immutable Double-Entry Credit Ledger
CREATE TABLE credit_ledger (
    ledger_id SERIAL PRIMARY KEY,
    member_id INT NOT NULL REFERENCES members(member_id) ON DELETE RESTRICT,
    reservation_id INT REFERENCES reservations(reservation_id) ON DELETE SET NULL,
    entry_type VARCHAR(30) NOT NULL
        CHECK (entry_type IN ('ANNUAL_ALLOCATION', 'BOOKING_DEBIT', 'CANCELLATION_REFUND', 'BONUS_ADJUSTMENT')),
    delta INT NOT NULL CHECK (delta <> 0),
    balance_after INT NOT NULL CHECK (balance_after >= 0),
    notes VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_units_property_status ON units(property_id, status);
CREATE INDEX idx_reservations_unit_dates ON reservations(unit_id, check_in, check_out);
CREATE INDEX idx_reservations_member ON reservations(member_id, status);
CREATE INDEX idx_ledger_member_created ON credit_ledger(member_id, created_at DESC);

-- Operational KPI Reporting View
CREATE OR REPLACE VIEW vw_property_operations_kpi AS
SELECT
    p.property_id,
    p.code,
    p.name,
    p.region,
    COUNT(DISTINCT u.unit_id) AS total_units,
    COUNT(DISTINCT u.unit_id) FILTER (WHERE u.status = 'AVAILABLE') AS available_units,
    COUNT(DISTINCT u.unit_id) FILTER (WHERE u.status = 'OCCUPIED') AS occupied_units,
    COUNT(DISTINCT u.unit_id) FILTER (WHERE u.status = 'MAINTENANCE') AS maintenance_units,
    ROUND(
        COALESCE(
            COUNT(DISTINCT u.unit_id) FILTER (WHERE u.status = 'OCCUPIED')::NUMERIC
            / NULLIF(COUNT(DISTINCT u.unit_id) FILTER (WHERE u.status <> 'MAINTENANCE'), 0) * 100,
            0
        ), 1
    ) AS active_occupancy_pct,
    COUNT(DISTINCT r.reservation_id) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')) AS active_bookings,
    COALESCE(SUM(r.credits_charged) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')), 0) AS total_credits_redeemed,
    ROUND(
        COALESCE(AVG(r.nights) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')), 0),
        1
    ) AS avg_length_of_stay
FROM properties p
LEFT JOIN units u ON p.property_id = u.property_id
LEFT JOIN reservations r ON u.unit_id = r.unit_id
GROUP BY p.property_id, p.code, p.name, p.region;
