# Math Learning Route System

An open-source math learning route, diagnostic, assignment, and progress-tracking system for teachers and students.

The project organizes primary and middle-school math into ability routes with prerequisites, question banks, mastery checks, teacher assignments, student progress, mistake review, weekly diagnostics, and browser-based teacher/student workflows. It is designed for transparent teacher-led remediation rather than a black-box tutoring flow.

## Features

- Primary and middle-school math ability routes with module, node, and prerequisite structure.
- Diagnostic question banks, mastery checks, high-risk knowledge patches, and practice nodes.
- Teacher workflows for student management, targeted assignments, progress review, question review, and weekly reports.
- Student workflows for current tasks, node checks, mistake review, growth tracking, and progress review.
- Local JSON database for lightweight deployment and easy data inspection.
- Maintenance scripts for syntax checks, smoke tests, route validation, diagnostics, and deployment.

## Quick Start

Requires Node.js 20 or newer.

```bash
npm run check
node math_multiuser_server.mjs
```

Open:

```text
http://127.0.0.1:4180
```

On first launch, the app creates a local sample database with demo accounts:

```text
teacher / admin123
student1 / 123456
guest / guest
```

Change these credentials before using the system beyond a local demo.

## Useful Commands

```bash
npm run check
npm run smoke
npm run deploy
```

`npm run smoke` expects a running server and the environment variables documented in [docs/MAINTENANCE.md](docs/MAINTENANCE.md).

## Project Structure

```text
math_multiuser_server.mjs       Main HTTP server
server/                         Backend API, auth, database, routes, reports
public/                         Teacher and student browser UI
assets/                         Runtime visual assets
scripts/                        Diagnostics, validation, smoke tests, deployment
docs/                           Maintenance, architecture, and maintainer notes
```

## Data And Privacy

The public repository intentionally excludes local and production runtime data:

- `data/`: student records, password hashes, progress, assignments, mistakes, login logs, sync tokens.
- `studentspic/`: private student learning notes.
- `sites/`: local site experiments and generated preview projects.
- `node_modules/`, logs, environment files, and build artifacts.

The server can generate a demo `data/math-learning-db.json` automatically. Production deployments should keep their own `data/` directory outside Git history.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the main data flow, backend modules, frontend entry points, and deployment model.

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), and run `npm run check` before submitting changes.

## License

MIT License. See [LICENSE](LICENSE).
