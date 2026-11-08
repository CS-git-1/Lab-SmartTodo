# Smart Todo Backend

Node.js and Express starter project using ES modules. It currently contains only a Hello World route and a health check; CRUD endpoints have not been added.

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

The API uses `PORT` from `.env`; when it is not set, it listens on port `3000`. Visit `http://localhost:3000/` for the Hello World response or `http://localhost:3000/api/health` for the health check.

## Environment variables

`.env.example` documents `PORT`, the allowed CORS origin, and placeholder SQL Server settings for future database work. The current starter does not connect to SQL Server yet. Keep `.env` local; it is ignored by Git.

## SQL Server schema

The initial database schema is in [`schema.sql`](schema.sql). Run it in SQL Server Management Studio or with `sqlcmd` when setting up the database.
