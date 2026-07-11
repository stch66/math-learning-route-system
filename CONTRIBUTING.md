# Contributing

Thank you for helping improve Math Learning Route System.

## Good First Contributions

- Improve documentation for local setup, deployment, or classroom workflows.
- Add focused tests or validation scripts for route data, question banks, or assignment behavior.
- Report confusing teacher or student flows with screenshots and reproduction steps.
- Review question wording, distractors, prerequisites, and high-risk remediation nodes.

## Local Checks

Run the syntax and script checks before opening a pull request:

```bash
npm run check
```

For server behavior changes, also run the smoke test against a local or staging server:

```bash
MATH_BASE_URL='http://127.0.0.1:4180' \
MATH_TEACHER_USERNAME='teacher' \
MATH_TEACHER_PASSWORD='admin123' \
node scripts/smoke_math_system.mjs
```

## Privacy Rules

Do not commit production or real student data.

Keep these paths out of pull requests:

- `data/`
- `studentspic/`
- `.env*`
- logs, database backups, generated installers, and dependency folders

When sharing bugs, replace student names, IP addresses, login logs, and passwords with placeholders.

## Pull Request Checklist

- Explain the user-facing behavior changed by the PR.
- Mention any route-data, question-bank, or database-shape changes.
- Include screenshots for teacher or student UI changes.
- Confirm `npm run check` passes.
- Avoid unrelated formatting churn in generated route or question-bank files.
