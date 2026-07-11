# Security Policy

## Supported Version

The `main` branch is the currently supported development line.

## Reporting A Vulnerability

Please report security issues privately to the maintainer rather than opening a public issue.

Include:

- Affected file or endpoint.
- Steps to reproduce.
- Expected impact.
- Whether real student data, passwords, session cookies, login logs, or sync tokens may be exposed.

## Sensitive Data

The repository is designed so runtime data stays outside Git:

- `data/` stores student records, password hashes, assignments, progress, mistakes, login logs, and sync tokens.
- `studentspic/` stores private student learning notes.
- `.env*` and deployment secrets must stay local.

Before publishing a fork or issue reproduction, run:

```bash
git status --short
git diff --cached --name-only | grep -E '^(data/|studentspic/|sites/|node_modules/|_local_archive/)' || true
```

No real credentials, API keys, private SSH hosts, or student records should appear in commits.
