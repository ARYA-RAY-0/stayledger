import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';

export class AnalyticsController {
  static async overview(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnalyticsService.getExecutiveOverview();
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}
