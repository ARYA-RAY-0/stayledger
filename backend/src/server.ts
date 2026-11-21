import dotenv from 'dotenv';
import app from './app';
import { pool } from './config/db';

dotenv.config();
const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, () => {
  console.log(`StayLedger API running on http://localhost:${PORT}/api`);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});