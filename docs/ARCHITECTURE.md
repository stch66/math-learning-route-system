# Architecture

## Runtime Shape

The application is a lightweight Node.js HTTP server with browser-based teacher and student interfaces. It uses a local JSON database for small-school or tutoring-center deployments where transparent data ownership matters more than a managed database service.

```text
Browser UI
  -> math_multiuser_server.mjs
    -> server/auth.mjs
    -> server/students.mjs
    -> server/progress.mjs
    -> server/assignments.mjs
    -> server/questions.mjs
    -> server/reports.mjs
    -> server/db.mjs
      -> data/math-learning-db.json
```

## Main Modules

- `math_multiuser_server.mjs`: HTTP server, route wiring, static assets, API dispatch, route-data loading, and page startup data.
- `server/auth.mjs`: password hashing, session cookie handling, current-user lookup, login, logout, and password changes.
- `server/db.mjs`: JSON database creation, reading, normalization, and atomic writes.
- `server/routes.mjs`: route lookup, node unlock policy, prerequisite checks, assignment node parsing, and route-key detection.
- `server/students.mjs`: teacher-managed student creation.
- `server/progress.mjs`: student progress reads, manual updates, batch updates, weekly reports, and rollback.
- `server/assignments.mjs`: assignment creation, reading, completion state, archive, and teacher confirmation.
- `server/questions.mjs`: node checks, question submission, automatic grading, and validation.
- `server/questionReview.mjs`: teacher review overlays and visibility filtering for reviewed questions.
- `server/reports.mjs`: weekly diagnostics, learned-node summaries, next-week recommendations, and remediation suggestions.
- `server/offlineSync.mjs`: token-based sync endpoints for clients that need batched attempt upload.

## Frontend Entry Points

- `public/shared.js`: shared route rendering, data loading, node dialogs, checks, and progress helpers.
- `public/admin.js`: teacher-facing flows.
- `public/student.js`: student-facing task, review, and growth flows.
- `public/style.css`: shared visual system for teacher and student screens.

## Route And Question Data

The project includes route maps, DAGs, mastery checks, high-risk patches, and generated practice nodes as repository data. Runtime student progress is separate and is stored under `data/`, which is intentionally ignored by Git.

## Deployment Model

The current deployment script supports a simple SSH-based workflow:

```bash
MATH_SERVER_HOST='deploy@your-server' \
MATH_TEACHER_PASSWORD='teacher-password' \
npm run deploy
```

The deployment script backs up the remote app and database, uploads code and assets, runs remote syntax checks, validates active homework nodes, restarts the systemd service, checks `/healthz`, and optionally runs the smoke test.

For Git-based deployment, keep the production `data/` directory on the server and use Git only for code, route data, assets, scripts, and documentation.
