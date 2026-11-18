import cors from 'cors';
import express from 'express';
import authenticate from './middleware/authenticate.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import { logServerError, sendApiError } from './utils/apiError.js';

const app = express();

const configuredOrigin = process.env.CORS_ORIGIN?.trim();
if (process.env.NODE_ENV === 'production' && !configuredOrigin) {
  throw new Error('CORS_ORIGIN must be set to the exact frontend origin in production');
}

const allowedOrigin = configuredOrigin || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use((req, res, next) => {
  const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const requestOrigin = req.get('Origin');
  const originIsInvalid = process.env.NODE_ENV === 'production'
    ? requestOrigin !== allowedOrigin
    : Boolean(requestOrigin && requestOrigin !== allowedOrigin);
  if (isUnsafeMethod && originIsInvalid) {
    return sendApiError(res, 403, 'ORIGIN_NOT_ALLOWED', 'คำขอมาจากแหล่งที่ไม่อนุญาต');
  }
  next();
});
app.use((req, _res, next) => {
  const sessionCookie = (req.headers.cookie ?? '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith('smart-todo.session='));
  req.cookies = { 'smart-todo.session': sessionCookie?.slice('smart-todo.session='.length) };
  next();
});
app.use(express.json({ limit: '16kb' }));
app.use('/api/auth', authRoutes);
app.use('/api/tasks', authenticate, taskRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true });
});

app.get('/', (_req, res) => {
  res.json({ message: 'Smart Todo API is running' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((_req, _res, next) => {
  const error = new Error('Route not found');
  error.status = 404;
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
});

app.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  const parserErrors = {
    'entity.parse.failed': [400, 'INVALID_JSON', 'Invalid JSON request body'],
    'entity.too.large': [413, 'PAYLOAD_TOO_LARGE', 'Request body is too large'],
  };
  const parserError = parserErrors[error.type];
  if (parserError) {
    return sendApiError(res, parserError[0], parserError[1], parserError[2]);
  }
  if (error.status === 404 && error.code === 'ROUTE_NOT_FOUND') {
    return sendApiError(res, 404, 'ROUTE_NOT_FOUND', 'API route not found');
  }
  logServerError('Unhandled request error', error);
  return sendApiError(res, 500, 'INTERNAL_SERVER_ERROR', 'An unexpected server error occurred');
});

export default app;
