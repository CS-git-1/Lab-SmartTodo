# Smart Todo Backend

Node.js and Express API using ES modules, HttpOnly cookie authentication, owner-scoped task CRUD, and Azure SQL Server.

## Requirements

- Node.js 18 or later
- npm

## Run locally

From the `backend` directory, install dependencies:

```bash
npm install
```

Create a local environment file from the example:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux, use `cp .env.example .env` instead.

Start in development mode with automatic restart on file changes:

```bash
npm run dev
```

Start in regular mode:

```bash
npm start
```

The API uses `PORT` from `.env` (default `3000`) and `HOST` (default `127.0.0.1`). Visit `http://localhost:3000/` for the Hello World response, `http://localhost:3000/api/health` for the health check. In deployment, keep the API bound to localhost and expose it through the reverse proxy.

## Task API

Authentication endpoints are available at `POST /api/auth/register`, `POST /api/auth/login`, and `GET /api/auth/me`. Register and login set an eight-hour `HttpOnly` session cookie. Task routes and `GET /api/auth/me` use that cookie; the owner is taken from the verified token, never from a caller-supplied user ID. `POST /api/auth/logout` clears the cookie. Set `CORS_ORIGIN` to the exact frontend origin; non-safe requests with an `Origin` header from another origin are rejected. Production deployments must use HTTPS so the cookie is marked `Secure`.

Task CRUD endpoints use `dbo.Tasks`:

- `GET /tasks?page=1&limit=20` lists the signed-in user's tasks with optional `status`, `priority`, `projectId`, and title `q` filters.
- `GET /tasks/:taskId` reads one of the signed-in user's tasks.
- `POST /tasks` creates a task with `title`; project, description, status, priority, dates, estimate, and sort order are optional. Status defaults to `todo`, and priority defaults to `2`.
- `PATCH /tasks/:taskId` updates supplied task fields.
- `PUT /tasks/:taskId` requires `title` and `isCompleted`; optional description, priority, date, project, estimate, and sort fields are also accepted for full-form edits.
- `DELETE /tasks/:taskId` deletes an owned task and its checklist, tag links, and reminders in a transaction.

The same endpoints are also available under `/api/tasks` for compatibility. Routes, controllers, services, and database connection are separated under `src/`.

Set `AUTH_TOKEN_SECRET` to a random secret of at least 32 characters. The `Users` table stores scrypt password hashes; the raw password is never stored. Do not reuse the example secret in a deployed environment.

## Environment variables

`.env.example` documents `PORT`, the allowed CORS origin, and Azure SQL Server settings. Set `DB_PASSWORD` in your local `.env`. The database connection pool is created lazily and reused by requests. Keep `.env` local; it is ignored by Git.

## SQL Server schema

The seven-table database schema is in [`schema.sql`](schema.sql). Run it while connected to the target Azure SQL database. The schema uses UUID keys and is not compatible with the older `Todos`/`BIGINT` schema without a migration.
