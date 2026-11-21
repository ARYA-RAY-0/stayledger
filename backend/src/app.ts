import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from './routes/api.routes';
import { ApiError } from './types/models';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api', apiRoutes);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code || 'API_ERROR'
    });
  }
  console.error('Unhandled API Error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

export default app;
