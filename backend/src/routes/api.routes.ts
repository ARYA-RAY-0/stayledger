import { Router } from 'express';
import { PropertiesController } from '../controllers/properties.controller';
import { ReservationsController } from '../controllers/reservations.controller';
import { AnalyticsController } from '../controllers/analytics.controller';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'stayledger-api' }));
router.get('/analytics/overview', AnalyticsController.overview);
router.get('/properties', PropertiesController.getProperties);
router.get('/units', PropertiesController.getUnits);
router.patch('/units/:id/status', PropertiesController.updateUnitStatus);
router.get('/members', PropertiesController.getMembers);
router.get('/reservations', ReservationsController.list);
router.post('/reservations', ReservationsController.create);
router.patch('/reservations/:id/cancel', ReservationsController.cancel);

export default router;
