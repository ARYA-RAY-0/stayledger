import request from "supertest";
import app from "../app";
import { pool } from "../config/db";

describe("StayLedger Reservation & Ledger Integrity", () => {
  let createdReservationId: number;

  afterAll(async () => {
    await pool.end();
  });

  it("returns executive CTE analytics overview", async () => {
    const res = await request(app).get("/api/analytics/overview");
    expect(res.status).toBe(200);
    expect(res.body.kpis.total_units).toBe(12);
    expect(res.body.properties).toHaveLength(3);
  });

  it("creates a reservation, deducts credits, and appends immutable ledger entry", async () => {
    const res = await request(app)
      .post("/api/reservations")
      .send({
        unit_id: 3,
        member_id: 1,
        season_name: "MID",
        check_in: "2027-02-10",
        check_out: "2027-02-12"
      });

    expect(res.status).toBe(201);
    expect(res.body.credits_charged).toBe(1300);
    expect(res.body.new_member_balance).toBe(3500);
    createdReservationId = res.body.reservation_id;
  });

  it("rejects overlapping reservation dates with 409 Conflict via PostgreSQL GIST lock", async () => {
    const res = await request(app)
      .post("/api/reservations")
      .send({
        unit_id: 3,
        member_id: 2,
        season_name: "MID",
        check_in: "2027-02-11",
        check_out: "2027-02-14"
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DATE_CONFLICT");
  });

  it("cancels reservation and issues full atomic refund to ledger", async () => {
    const res = await request(app).patch(`/api/reservations/${createdReservationId}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.credits_refunded).toBe(1300);
    expect(res.body.new_member_balance).toBe(4800);
  });
});