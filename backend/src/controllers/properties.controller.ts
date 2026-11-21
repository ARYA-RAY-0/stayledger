import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/db';
import { ApiError, UnitStatus } from '../types/models';

export class PropertiesController {
  static async getProperties(_req: Request, res: Response, next: NextFunction) {
    try {
      const { rows } = await pool.query('SELECT * FROM vw_property_operations_kpi ORDER BY property_id');
      res.json(rows);
    } catch (err) {
      next(err);
    }
  }

  static async getUnits(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyId, status } = req.query;
      const conditions: string[] = [];
      const values: any[] = [];

      if (propertyId) {
        values.push(Number(propertyId));
        conditions.push(`u.property_id = $${values.length}`);
      }
      if (status) {
        values.push(String(status).toUpperCase());
        conditions.push(`u.status = $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT
          u.*,
          p.name AS property_name,
          p.code AS property_code,
          p.region
        FROM units u
        JOIN properties p ON u.property_id = p.property_id
        ${whereClause}
        ORDER BY p.property_id, u.unit_code;
      `;
      const { rows } = await pool.query(query, values);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  }

  static async updateUnitStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const unitId = Number(req.params.id);
      const status = String(req.body.status || '').toUpperCase() as UnitStatus;
      const allowed: UnitStatus[] = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'];

      if (!allowed.includes(status)) {
        throw new ApiError(400, `Invalid unit status. Allowed: ${allowed.join(', ')}`);
      }

      const { rows, rowCount } = await pool.query(
        `UPDATE units SET status = $1 WHERE unit_id = $2 RETURNING *`,
        [status, unitId]
      );
      if (rowCount === 0) {
        throw new ApiError(404, 'Unit not found.');
      }
      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  }

  static async getMembers(_req: Request, res: Response, next: NextFunction) {
    try {
      const { rows } = await pool.query(
        `SELECT member_id, member_no, full_name, email, tier, credits_balance, credits_expiry_date::text
         FROM members ORDER BY member_id`
      );
      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
}