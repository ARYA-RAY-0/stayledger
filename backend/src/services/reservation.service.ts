import { pool } from '../config/db';
import { ApiError, CreateReservationDTO } from '../types/models';

export class ReservationService {
  static async listReservations() {
    const query = `
      SELECT
        r.reservation_id,
        r.reference_code,
        r.check_in::text,
        r.check_out::text,
        r.nights,
        r.credits_charged,
        r.status,
        r.created_at,
        u.unit_id,
        u.unit_code,
        u.unit_type,
        p.property_id,
        p.name AS property_name,
        p.code AS property_code,
        m.member_id,
        m.member_no,
        m.full_name AS member_name,
        m.tier AS member_tier,
        s.season_name
      FROM reservations r
      JOIN units u ON r.unit_id = u.unit_id
      JOIN properties p ON u.property_id = p.property_id
      JOIN members m ON r.member_id = m.member_id
      JOIN season_bands s ON r.season_id = s.season_id
      ORDER BY r.created_at DESC, r.reservation_id DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  }

  static async createReservation(dto: CreateReservationDTO) {
    const { unit_id, member_id, season_name, check_in, check_out } = dto;

    if (!unit_id || !member_id || !season_name || !check_in || !check_out) {
      throw new ApiError(400, 'Missing required reservation fields.');
    }

    const start = new Date(check_in);
    const end = new Date(check_out);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      throw new ApiError(400, 'check_out date must be strictly after check_in date.');
    }

    const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const unitRes = await client.query(
        `SELECT unit_id, unit_code, base_credits_per_night, status
         FROM units WHERE unit_id = $1 FOR UPDATE`,
        [unit_id]
      );
      if (unitRes.rowCount === 0) {
        throw new ApiError(404, 'Accommodation unit not found.');
      }
      const unit = unitRes.rows[0];
      if (unit.status === 'MAINTENANCE') {
        throw new ApiError(409, `Unit ${unit.unit_code} is currently offline for maintenance.`, 'UNIT_MAINTENANCE');
      }

      const seasonRes = await client.query(
        `SELECT season_id, multiplier FROM season_bands WHERE season_name = $1`,
        [season_name]
      );
      if (seasonRes.rowCount === 0) {
        throw new ApiError(400, `Invalid season band: ${season_name}`);
      }
      const season = seasonRes.rows[0];
      const creditsCharged = Math.round(unit.base_credits_per_night * nights * Number(season.multiplier));

      const memberRes = await client.query(
        `SELECT member_id, member_no, full_name, credits_balance, credits_expiry_date
         FROM members WHERE member_id = $1 FOR UPDATE`,
        [member_id]
      );
      if (memberRes.rowCount === 0) {
        throw new ApiError(404, 'Member profile not found.');
      }
      const member = memberRes.rows[0];

      if (new Date(member.credits_expiry_date) < end) {
        throw new ApiError(400, 'Member credits expire prior to checkout date.', 'CREDITS_EXPIRED');
      }
      if (member.credits_balance < creditsCharged) {
        throw new ApiError(
          402,
          `Insufficient credits: requires ${creditsCharged}, member has ${member.credits_balance}.`,
          'INSUFFICIENT_CREDITS'
        );
      }

      const refCode = `RES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const insertRes = await client.query(
        `INSERT INTO reservations (reference_code, unit_id, member_id, season_id, check_in, check_out, credits_charged, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED')
         RETURNING *`,
        [refCode, unit_id, member_id, season.season_id, check_in, check_out, creditsCharged]
      );
      const reservation = insertRes.rows[0];

      const newBalance = member.credits_balance - creditsCharged;
      await client.query(
        `UPDATE members SET credits_balance = $1 WHERE member_id = $2`,
        [newBalance, member_id]
      );

      await client.query(
        `INSERT INTO credit_ledger (member_id, reservation_id, entry_type, delta, balance_after, notes)
         VALUES ($1, $2, 'BOOKING_DEBIT', $3, $4, $5)`,
        [
          member_id,
          reservation.reservation_id,
          -creditsCharged,
          newBalance,
          `Reservation ${refCode} (${unit.unit_code} - ${nights} nights ${season_name})`
        ]
      );

      await client.query('COMMIT');
      return { ...reservation, new_member_balance: newBalance };
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.code === '23P01') {
        throw new ApiError(
          409,
          'Double-booking conflict: this unit is already reserved for overlapping dates.',
          'DATE_CONFLICT'
        );
      }
      throw err;
    } finally {
      client.release();
    }
  }

  static async cancelReservation(reservationId: number) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resQuery = await client.query(
        `SELECT r.*, u.unit_code
         FROM reservations r
         JOIN units u ON r.unit_id = u.unit_id
         WHERE r.reservation_id = $1 FOR UPDATE`,
        [reservationId]
      );
      if (resQuery.rowCount === 0) {
        throw new ApiError(404, 'Reservation not found.');
      }
      const reservation = resQuery.rows[0];
      if (reservation.status === 'CANCELLED') {
        throw new ApiError(409, 'Reservation is already cancelled.');
      }

      const memberQuery = await client.query(
        `SELECT member_id, credits_balance FROM members WHERE member_id = $1 FOR UPDATE`,
        [reservation.member_id]
      );
      const member = memberQuery.rows[0];
      const refundedBalance = member.credits_balance + reservation.credits_charged;

      await client.query(
        `UPDATE reservations SET status = 'CANCELLED' WHERE reservation_id = $1`,
        [reservationId]
      );
      await client.query(
        `UPDATE members SET credits_balance = $1 WHERE member_id = $2`,
        [refundedBalance, member.member_id]
      );
      await client.query(
        `INSERT INTO credit_ledger (member_id, reservation_id, entry_type, delta, balance_after, notes)
         VALUES ($1, $2, 'CANCELLATION_REFUND', $3, $4, $5)`,
        [
          member.member_id,
          reservationId,
          reservation.credits_charged,
          refundedBalance,
          `Full credit refund for cancelled booking ${reservation.reference_code} (${reservation.unit_code})`
        ]
      );

      await client.query('COMMIT');
      return {
        reservation_id: reservationId,
        reference_code: reservation.reference_code,
        status: 'CANCELLED',
        credits_refunded: reservation.credits_charged,
        new_member_balance: refundedBalance
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}