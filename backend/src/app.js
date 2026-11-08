import cors from 'cors';
import express from 'express';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'Smart Todo API is running' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
