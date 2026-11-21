-- Seed Season Bands
INSERT INTO season_bands (season_name, multiplier, description) VALUES
('PEAK', 1.50, 'School holidays, festive season & long weekends'),
('MID', 1.00, 'Standard shoulder-season travel window'),
('OFF_PEAK', 0.75, 'Low-demand mid-week & winter getaway window');

-- Seed Properties (Original fictional coastal & mountain properties)
INSERT INTO properties (code, name, region, province, total_capacity) VALUES
('UMD-01', 'Umdloti Cove Suites', 'North Coast', 'KwaZulu-Natal', 4),
('DRK-02', 'Drakensberg Ridge Lodge', 'Central Berg', 'KwaZulu-Natal', 4),
('WLD-03', 'Wild Coast Sanctuary', 'South Coast', 'KwaZulu-Natal', 4);

-- Seed Units (12 Units across 3 Properties)
INSERT INTO units (property_id, unit_code, unit_type, sleeps, base_credits_per_night, status) VALUES
(1, 'U101', '2-Bedroom Ocean Chalet', 4, 400, 'OCCUPIED'),
(1, 'U102', '2-Bedroom Ocean Chalet', 4, 400, 'AVAILABLE'),
(1, 'U103', '3-Bedroom Penthouse Villa', 6, 650, 'AVAILABLE'),
(1, 'U104', '1-Bedroom Studio Suite', 2, 250, 'MAINTENANCE'),
(2, 'D201', '2-Bedroom Mountain Cabin', 4, 380, 'OCCUPIED'),
(2, 'D202', '4-Bedroom Heritage Lodge', 8, 800, 'AVAILABLE'),
(2, 'D203', '2-Bedroom Mountain Cabin', 4, 380, 'AVAILABLE'),
(2, 'D204', '1-Bedroom Forest Loft', 2, 240, 'AVAILABLE'),
(3, 'W301', '3-Bedroom Estuary Villa', 6, 550, 'OCCUPIED'),
(3, 'W302', '2-Bedroom Lagoon Chalet', 4, 360, 'AVAILABLE'),
(3, 'W303', '2-Bedroom Lagoon Chalet', 4, 360, 'MAINTENANCE'),
(3, 'W304', '1-Bedroom Dune Suite', 2, 220, 'AVAILABLE');

-- Seed Members
INSERT INTO members (member_no, full_name, email, tier, credits_balance, credits_expiry_date) VALUES
('SL-1001', 'Thabo Mokoena', 'thabo.mokoena@example.co.za', 'PLATINUM', 8200, '2027-12-31'),
('SL-1002', 'Anika Naidoo', 'anika.naidoo@example.co.za', 'GOLD', 4850, '2027-09-30'),
('SL-1003', 'Pieter van der Merwe', 'pieter.vdm@example.co.za', 'SILVER', 2600, '2027-06-30'),
('SL-1004', 'Zainab Patel', 'zainab.patel@example.co.za', 'GOLD', 5400, '2027-11-30');

-- Seed Initial Annual Allocations into Immutable Ledger
INSERT INTO credit_ledger (member_id, reservation_id, entry_type, delta, balance_after, notes) VALUES
(1, NULL, 'ANNUAL_ALLOCATION', 10000, 10000, '2026 Platinum Tier Annual Credit Allocation'),
(2, NULL, 'ANNUAL_ALLOCATION', 6500, 6500, '2026 Gold Tier Annual Credit Allocation'),
(3, NULL, 'ANNUAL_ALLOCATION', 4000, 4000, '2026 Silver Tier Annual Credit Allocation'),
(4, NULL, 'ANNUAL_ALLOCATION', 6500, 6500, '2026 Gold Tier Annual Credit Allocation');

-- Seed Active & Historical Reservations
INSERT INTO reservations (reference_code, unit_id, member_id, season_id, check_in, check_out, credits_charged, status) VALUES
('RES-2026-001', 1, 1, 2, '2026-11-20', '2026-11-24', 1600, 'CHECKED_IN'),
('RES-2026-002', 5, 2, 2, '2026-11-21', '2026-11-25', 1520, 'CHECKED_IN'),
('RES-2026-003', 9, 4, 3, '2026-11-19', '2026-11-22', 1238, 'CHECKED_IN'),
('RES-2026-004', 2, 3, 1, '2026-12-15', '2026-12-18', 1800, 'CONFIRMED'),
('RES-2026-005', 6, 1, 1, '2026-12-20', '2026-12-23', 3600, 'CONFIRMED');

-- Record Corresponding Booking Debits in Ledger (Keeping balances exact)
INSERT INTO credit_ledger (member_id, reservation_id, entry_type, delta, balance_after, notes) VALUES
(1, 1, 'BOOKING_DEBIT', -1600, 8400, 'Reservation RES-2026-001 (U101 - 4 nights MID)'),
(2, 2, 'BOOKING_DEBIT', -1520, 4980, 'Reservation RES-2026-002 (D201 - 4 nights MID)'),
(4, 3, 'BOOKING_DEBIT', -1238, 5262, 'Reservation RES-2026-003 (W301 - 3 nights OFF_PEAK)'),
(3, 4, 'BOOKING_DEBIT', -1800, 2200, 'Reservation RES-2026-004 (U102 - 3 nights PEAK)'),
(1, 5, 'BOOKING_DEBIT', -3600, 4800, 'Reservation RES-2026-005 (D202 - 3 nights PEAK)');

-- Sync member balances to match final ledger rows
UPDATE members SET credits_balance = 4800 WHERE member_id = 1;
UPDATE members SET credits_balance = 4980 WHERE member_id = 2;
UPDATE members SET credits_balance = 2200 WHERE member_id = 3;
UPDATE members SET credits_balance = 5262 WHERE member_id = 4;
