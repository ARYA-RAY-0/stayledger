import { pool } from '../config/db';

export class AnalyticsService {
  static async getExecutiveOverview() {
    const query = `
      WITH portfolio_units AS (
        SELECT
          COUNT(*) AS total_units,
          COUNT(*) FILTER (WHERE status = 'AVAILABLE') AS available_units,
          COUNT(*) FILTER (WHERE status = 'OCCUPIED') AS occupied_units,
          COUNT(*) FILTER (WHERE status = 'MAINTENANCE') AS maintenance_units
        FROM units
      ),
      booking_metrics AS (
        SELECT
          COUNT(*) FILTER (WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')) AS active_bookings,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_bookings,
          COUNT(*) AS total_bookings,
          COALESCE(SUM(credits_charged) FILTER (WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')), 0) AS total_credits_redeemed,
          ROUND(COALESCE(AVG(nights) FILTER (WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')), 0), 1) AS avg_length_of_stay
        FROM reservations
      ),
      member_liability AS (
        SELECT
          COUNT(*) AS total_members,
          COALESCE(SUM(credits_balance), 0) AS unredeemed_credit_liability
        FROM members
      ),
      season_breakdown AS (
        SELECT
          s.season_name,
          COUNT(r.reservation_id) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')) AS booking_count,
          COALESCE(SUM(r.nights) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')), 0) AS total_nights,
          COALESCE(SUM(r.credits_charged) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')), 0) AS credits_yield
        FROM season_bands s
        LEFT JOIN reservations r ON s.season_id = r.season_id
        GROUP BY s.season_id, s.season_name
        ORDER BY s.season_id
      ),
      ledger_sums AS (
        SELECT
          member_id,
          COALESCE(SUM(delta), 0)::int AS ledger_net_delta,
          COUNT(*)::int AS entry_count
        FROM credit_ledger
        GROUP BY member_id
      ),
      member_reconciliation AS (
        SELECT
          m.member_id,
          m.member_no,
          m.full_name,
          m.credits_balance::int AS stored_balance,
          COALESCE(ls.ledger_net_delta, 0)::int AS ledger_sum,
          (m.credits_balance - COALESCE(ls.ledger_net_delta, 0))::int AS variance,
          COALESCE(ls.entry_count, 0)::int AS entry_count
        FROM members m
        LEFT JOIN ledger_sums ls ON m.member_id = ls.member_id
        ORDER BY m.member_id
      ),
      orphan_debits AS (
        SELECT COUNT(*)::int AS missing_debit_count
        FROM reservations r
        LEFT JOIN credit_ledger cl
          ON cl.reservation_id = r.reservation_id AND cl.entry_type = 'BOOKING_DEBIT'
        WHERE r.status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')
          AND cl.ledger_id IS NULL
      )
      SELECT
        pu.total_units::int,
        pu.available_units::int,
        pu.occupied_units::int,
        pu.maintenance_units::int,
        ROUND(
          COALESCE(pu.occupied_units::numeric / NULLIF(pu.total_units - pu.maintenance_units, 0) * 100, 0),
          1
        )::float AS portfolio_occupancy_pct,
        bm.active_bookings::int,
        bm.cancelled_bookings::int,
        ROUND(
          COALESCE(bm.cancelled_bookings::numeric / NULLIF(bm.total_bookings, 0) * 100, 0),
          1
        )::float AS cancellation_rate_pct,
        bm.total_credits_redeemed::int,
        ml.unredeemed_credit_liability::int,
        ROUND(
          COALESCE(bm.total_credits_redeemed::numeric / NULLIF(pu.total_units, 0), 0),
          0
        )::int AS credits_per_available_unit,
        bm.avg_length_of_stay::float,
        ml.total_members::int,
        (SELECT json_agg(season_breakdown) FROM season_breakdown) AS season_yield,
        json_build_object(
          'status', CASE
            WHEN EXISTS (SELECT 1 FROM member_reconciliation WHERE variance <> 0)
              OR (SELECT missing_debit_count FROM orphan_debits) > 0
            THEN 'DRIFT_DETECTED'
            ELSE 'BALANCED'
          END,
          'total_variance', COALESCE((SELECT SUM(ABS(variance))::int FROM member_reconciliation), 0),
          'missing_debit_count', (SELECT missing_debit_count FROM orphan_debits),
          'checked_at', NOW(),
          'members', (SELECT json_agg(member_reconciliation) FROM member_reconciliation)
        ) AS reconciliation
      FROM portfolio_units pu
      CROSS JOIN booking_metrics bm
      CROSS JOIN member_liability ml;
    `;

    const [overviewRes, propertiesRes, ledgerRes] = await Promise.all([
      pool.query(query),
      pool.query('SELECT * FROM vw_property_operations_kpi ORDER BY property_id'),
      pool.query(`
        SELECT
          l.ledger_id,
          l.entry_type,
          l.delta,
          l.balance_after,
          l.notes,
          l.created_at,
          m.member_no,
          m.full_name AS member_name
        FROM credit_ledger l
        JOIN members m ON l.member_id = m.member_id
        ORDER BY l.ledger_id DESC
        LIMIT 12;
      `)
    ]);

    return {
      kpis: overviewRes.rows[0],
      properties: propertiesRes.rows,
      recent_ledger: ledgerRes.rows
    };
  }
}