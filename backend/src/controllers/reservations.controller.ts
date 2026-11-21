import { Request, Response, NextFunction } from 'express';
import { ReservationService } from '../services/reservation.service';

export class ReservationsController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReservationService.listReservations();
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const created = await ReservationService.createReservation(req.body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReservationService.cancelReservation(Number(req.params.id));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
