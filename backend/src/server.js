import 'dotenv/config';

import app from './app.js';
import { assertAuthConfiguration } from './services/authService.js';

assertAuthConfiguration();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';

app.listen(port, host, () => {
  console.log(`Smart Todo API listening on http://${host}:${port}`);
});
