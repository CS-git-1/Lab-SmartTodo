# Smart Todo API test cases

> Historical evidence only: the results below predate the current HttpOnly-cookie authentication and request-size limits. They are not verification of the current implementation. The current test plan below has not been run.

## Current security regression plan (not yet run)

| ID | Scenario | Expected result | Status |
|---|---|---|---|
| AUTH-01 | Call a task endpoint without the session cookie | HTTP 401 | Not run |
| AUTH-02 | Call with a malformed or tampered session token | HTTP 401 | Not run |
| AUTH-03 | Call with an expired session token | HTTP 401 | Not run |
| AUTH-04 | Use logout, then call a task endpoint with the cleared cookie | HTTP 401 | Not run |
| AUTHZ-01 | User A reads a task owned by user B | HTTP 404; no task data | Not run |
| AUTHZ-02 | User A updates or deletes a task owned by user B | HTTP 404; B's task unchanged | Not run |
| INPUT-01 | Submit title over 100 chars or description over 2,000 chars | HTTP 400; no database write | Not run |
| INPUT-02 | Submit estimatedMinutes outside 1 to 525,600 or sortOrder outside plus or minus 1,000,000 | HTTP 400; no database write | Not run |
| INPUT-03 | Submit invalid/non-ISO date, unknown JSON field, or unsupported list query field | HTTP 400; no database write | Not run |
| INPUT-04 | Submit page 10,001, non-integer page, or limit over 100 | HTTP 400; no database query | Not run |
| INPUT-05 | Submit malformed JSON or a JSON body over 16 KB | HTTP 400 or 413; generic error envelope | Not run |
| CORS-01 | Browser request from configured origin | CORS response allows configured origin and credentials | Not run |
| CORS-02 | State-changing browser request with a different Origin | HTTP 403 | Not run |
| CORS-03 | Request with no Origin (non-browser client) | Authentication still required on task routes | Not run |
| SQL-01 | Use SQL metacharacters in title/search values | Treated as data; no query structure change | Not run |
| UI-01 | Force API failure during create/edit/delete | No success state; input remains available to retry | Not run |
| UI-02 | Refresh after successful CRUD | UI reloads state persisted by backend | Not run |

Run account/ownership cases against a test database with two disposable users. Do not use production data. Cookie-based cases should use the current Postman collection or a browser; Entra token cases remain pending until MSAL is implemented.

## Historical authenticated smoke verification (pre-cookie migration)

The authenticated CRUD flow was exercised against the configured Azure SQL database on 2026-11-09. Temporary unique accounts and task rows were removed in a cleanup transaction after the run.

| Flow | Result |
|---|---|
| Register, login, and `GET /api/auth/me` | Pass |
| Create task with description, priority, and due date; confirm returned DTO | Pass |
| List and read the created task | Pass |
| Verify another account cannot list or read the task | Pass |
| Update completion and priority; delete and confirm HTTP 204 | Pass |
| Anonymous task request | HTTP 401 |
| Azure SQL `/testdb` health check | Pass |

## Historical PUT contract verification

After switching frontend edit and completion actions to `PUT`, the updated contract was exercised against Azure SQL. The temporary account and task row were deleted after the run.

| Flow | Result |
|---|---|
| `POST /api/tasks` creates a task | Pass |
| `PUT /api/tasks/:taskId` sends both `title` and `isCompleted` to mark complete | Pass |
| `PUT /api/tasks/:taskId` updates title and optional description/priority/due date | Pass |
| `DELETE /api/tasks/:taskId` returns HTTP 204 with no JSON body | Pass |

Run date: 2026-11-08
Target: local backend at `http://localhost:3001` connected to the configured Azure SQL test database
Collection: [`postman.json`](postman.json)

## Results

| # | Scenario | Expected | Actual | Result |
|---:|---|---|---|---|
| 1 | `GET /` | HTTP 200 with API running message | HTTP 200, message returned | Pass |
| 2 | `GET /health` | HTTP 200, `success: true` | HTTP 200, success returned | Pass |
| 3 | `GET /api/health` | HTTP 200, `status: ok` | HTTP 200, status returned | Pass |
| 4 | `GET /testdb` | HTTP 200, database connection succeeds | HTTP 200, connected to Azure SQL | Pass |
| 5 | `POST /tasks` with blank title | HTTP 400, error envelope | HTTP 400, `success: false` | Pass |
| 6 | `POST /tasks` with padded title | HTTP 201, trimmed title and generated task ID | HTTP 201, title trimmed and task ID returned | Pass |
| 7 | `GET /tasks` with filters and pagination | HTTP 200, data array and pagination metadata | HTTP 200, both returned | Pass |
| 8 | `GET /api/tasks` with no matching data | HTTP 200, exactly `{ "data": [] }` | HTTP 200, exact empty contract returned | Pass |
| 9 | `GET /tasks/:taskId` for created task | HTTP 200, matching task ID | HTTP 200, created task returned | Pass |
| 10 | `PATCH /tasks/:taskId` | HTTP 200, updated title and status | HTTP 200, updated values returned | Pass |
| 11 | `PUT /tasks/:taskId` | HTTP 200, replaced title and completion state | HTTP 200, title trimmed and `isCompleted: true` | Pass |
| 12 | `PUT /tasks/:taskId` for missing task | HTTP 404 | HTTP 404 | Pass |
| 13 | `DELETE /tasks/:taskId` | HTTP 204 with empty body | HTTP 204, body length 0 | Pass |
| 14 | `DELETE /api/tasks/:taskId` for missing task | HTTP 404 with standard error envelope | HTTP 404, `success: false` | Pass |
| 15 | `GET /api/tasks` compatibility alias | HTTP 200 | HTTP 200 | Pass |

## Run

Start the backend with `PORT=3001`, then run from `backend/`:

```powershell
postman collection run .\postman.json --no-report-events
```

The collection uses the existing Postman test user from its `userId` variable. It creates a temporary task during the CRUD sequence and deletes it at the end.

## Run summary

- Requests executed: 15
- Assertions passed: 29
- Failed requests/assertions: 0
- Cloud run publication: not performed; the CLI session is not logged in

## Expanded contract matrix

`Expected` is derived from the current API contract. `Actual` records the observed status/body for each request; no case is marked as passing without a run.

| ID | Setup / request | Expected status | Expected body | Actual result |
|---|---|---:|---|---|
| GET-01 | `GET /api/tasks`; Header `X-User-Id: 00000000-0000-4000-8000-000000000001` (valid UUID with no tasks) | 200 | `{"data":[]}` | Previously run: HTTP 200 and exact empty contract |
| GET-02 | `GET /api/tasks/not-a-guid`; Header `X-User-Id: <valid user UUID>` | 400 | `{"success":false,"message":"Valid taskId and userId UUIDs are required"}` | HTTP 400; exact expected body |
| GET-03 | `GET /api/tasks/00000000-0000-4000-8000-000000000001`; Header `X-User-Id: <valid user UUID>` | 404 | `{"success":false,"message":"Task not found"}` | HTTP 404; exact expected body |
| POST-01 | `POST /api/tasks`; Header `X-User-Id: <existing user UUID>`; Body `{"title":"   "}` | 400 | `{"success":false,"message":"title must be 1–200 characters after trimming"}` | HTTP 400; exact expected body |
| POST-02 | Same setup; Body `{"title":123}` | 400 | `{"success":false,"message":"title must be a string"}` | HTTP 400; exact expected body |
| POST-03 | Same setup; Body `{"title":"<201 characters>"}` | 400 | `{"success":false,"message":"title must be 1–200 characters after trimming"}` | HTTP 400; exact expected body |
| PUT-01 | Create a task first and save its GUID as `taskId`; `PUT /api/tasks/{{taskId}}`; Header `X-User-Id`; Body `{"title":"Updated title","isCompleted":true}` | 200 | `{"success":true,"data":{"title":"Updated title","isCompleted":true,...}}` | Previously run: HTTP 200, title trimmed and completion true |
| PUT-02 | Same setup but Body `{"title":"Updated title","isCompleted":"true"}` | 400 | `{"success":false,"message":"isCompleted must be a boolean"}` | HTTP 400; exact expected body |
| PUT-03 | `PUT /api/tasks/not-a-guid`; Header `X-User-Id`; Body `{"title":"Updated title","isCompleted":false}` | 400 | `{"success":false,"message":"Valid taskId and userId UUIDs are required"}` | HTTP 400; exact expected body |
| PUT-04 | `PUT /api/tasks/00000000-0000-4000-8000-000000000001`; Header `X-User-Id`; valid body | 404 | `{"success":false,"message":"Task not found"}` | Previously run: HTTP 404 |
| DELETE-01 | Create a task first and save its GUID as `taskId`; `DELETE /api/tasks/{{taskId}}`; Header `X-User-Id` | 204 | Empty body | Previously run: HTTP 204, body length 0 |
| DELETE-02 | `DELETE /api/tasks/not-a-guid`; Header `X-User-Id` | 400 | `{"success":false,"message":"Valid taskId and userId UUIDs are required"}` | HTTP 400; exact expected body |
| DELETE-03 | `DELETE /api/tasks/00000000-0000-4000-8000-000000000001`; Header `X-User-Id` | 404 | `{"success":false,"message":"Task not found"}` | Previously run: HTTP 404 and standard error envelope |
| DB-01 | Start isolated backend with `DB_SERVER=127.0.0.1`, `DB_PORT=1`, `DB_LOGIN_TIMEOUT=1`; valid `GET /api/tasks` and `X-User-Id` | 500 | `{"success":false,"message":"Database request failed"}` | HTTP 500; exact expected body |
| DB-02 | Same isolated backend; valid `POST /api/tasks` body `{"title":"DB error test"}` and `X-User-Id` | 500 | `{"success":false,"message":"Database request failed"}` | HTTP 500; exact expected body |
| DB-03 | Same isolated backend; valid `PUT /api/tasks/<valid GUID>` body `{"title":"DB error test","isCompleted":false}` and `X-User-Id` | 500 | `{"success":false,"message":"Database request failed"}` | HTTP 500; exact expected body |
| DB-04 | Same isolated backend; valid `DELETE /api/tasks/<valid GUID>` and `X-User-Id` | 500 | `{"success":false,"message":"Database request failed"}` | HTTP 500; exact expected body |

### Database-error setup

Database-error cases were run in a separate backend process on a temporary port using an unreachable database host; the working `.env` and Azure database were not changed. All four methods returned the documented generic error envelope. The API intentionally hides driver details from clients.
