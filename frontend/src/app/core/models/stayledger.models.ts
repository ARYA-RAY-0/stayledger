export interface MemberReconciliationRow {
  member_id: number;
  member_no: string;
  full_name: string;
  stored_balance: number;
  ledger_sum: number;
  variance: number;
  entry_count: number;
}

export interface LedgerReconciliationSummary {
  status: 'BALANCED' | 'DRIFT_DETECTED';
  total_variance: number;
  missing_debit_count: number;
  checked_at: string;
  members: MemberReconciliationRow[];
}

export interface ExecutiveKpis {
  total_units: number;
  available_units: number;
  occupied_units: number;
  maintenance_units: number;
  portfolio_occupancy_pct: number;
  active_bookings: number;
  cancelled_bookings: number;
  cancellation_rate_pct: number;
  total_credits_redeemed: number;
  unredeemed_credit_liability: number;
  credits_per_available_unit: number;
  avg_length_of_stay: number;
  total_members: number;
  season_yield: SeasonYieldRow[];
  reconciliation: LedgerReconciliationSummary;
}

export interface SeasonYieldRow {
  season_name: 'PEAK' | 'MID' | 'OFF_PEAK';
  booking_count: number;
  total_nights: number;
  credits_yield: number;
}

export interface PropertyKpi {
  property_id: number;
  code: string;
  name: string;
  region: string;
  total_units: number;
  available_units: number;
  occupied_units: number;
  maintenance_units: number;
  active_occupancy_pct: number;
  active_bookings: number;
  total_credits_redeemed: number;
  avg_length_of_stay: number;
}

export interface LedgerEntry {
  ledger_id: number;
  entry_type: string;
  delta: number;
  balance_after: number;
  notes: string;
  created_at: string;
  member_no: string;
  member_name: string;
}

export interface AnalyticsOverviewResponse {
  kpis: ExecutiveKpis;
  properties: PropertyKpi[];
  recent_ledger: LedgerEntry[];
}

export interface UnitItem {
  unit_id: number;
  property_id: number;
  unit_code: string;
  unit_type: string;
  sleeps: number;
  base_credits_per_night: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
  property_name: string;
  property_code: string;
  region: string;
}

export interface MemberItem {
  member_id: number;
  member_no: string;
  full_name: string;
  email: string;
  tier: 'SILVER' | 'GOLD' | 'PLATINUM';
  credits_balance: number;
  credits_expiry_date: string;
}

export interface ReservationItem {
  reservation_id: number;
  reference_code: string;
  check_in: string;
  check_out: string;
  nights: number;
  credits_charged: number;
  status: 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
  unit_id: number;
  unit_code: string;
  unit_type: string;
  property_name: string;
  property_code: string;
  member_id: number;
  member_no: string;
  member_name: string;
  member_tier: string;
  season_name: 'PEAK' | 'MID' | 'OFF_PEAK';
}

export interface CreateReservationPayload {
  unit_id: number;
  member_id: number;
  season_name: 'PEAK' | 'MID' | 'OFF_PEAK';
  check_in: string;
  check_out: string;
}