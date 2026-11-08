# Repository Guidelines

## Project Structure & Module Organization

This directory contains the Smart Todo backend. `src/app.js` configures the Express app and routes; `src/server.js` loads environment variables and starts the HTTP listener. `schema.sql` defines the SQL Server database schema, and `.env.example` documents local settings. `README.md` covers setup and current endpoints. Dependencies are managed through `package.json` and `package-lock.json`. There is currently no test or asset directory.

## Build, Test, and Development Commands

Run commands from `backend/`:

- `npm install` installs dependencies from the lockfile.
- `npm run dev` starts the server with Node's watch mode for local development.
- `npm start` starts the server normally.

The service listens on `PORT` (default `3000`). Check `/` and `/api/health` in a browser or with `curl`. No build, test, or lint scripts are configured yet; add and document them when introducing those workflows.

## Coding Style & Naming Conventions

Use JavaScript ES modules (`import`/`export`) and the existing four-space indentation. Keep route and middleware setup in `src/app.js`; keep process startup in `src/server.js`. Use `camelCase` for variables and functions, and descriptive lowercase filenames such as `todoRoutes.js`. Keep configuration in environment variables, update `.env.example` when adding settings, and never commit `.env` or credentials. Preserve the SQL schema's descriptive table, column, and constraint names.

## Testing Guidelines

There is no test framework or coverage requirement in the current project. When adding tests, place them under `test/` or alongside the relevant module using `*.test.js`, and add a documented npm script. Cover route success cases, invalid input, and database behavior when database integration is added.

## Commit & Pull Request Guidelines

Git metadata is not present in this working directory, so repository-specific commit conventions cannot be confirmed. Use concise imperative commit subjects (for example, `Add todo health route`). Pull requests should explain the change and its motivation, list verification performed, link related issues, and include API examples or screenshots when they clarify a user-visible change.

## Security & Configuration

Copy `.env.example` to `.env` for local configuration. Restrict `CORS_ORIGIN` to the intended frontend origin outside local development. Store only password hashes as specified in `schema.sql`; never place secrets in source files or commits.
