#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${MATH_SERVER_HOST:-}"
REMOTE_DIR="${MATH_REMOTE_DIR:-/opt/math-system}"
NODE_BIN="${MATH_NODE_BIN:-/usr/local/bin/node20}"
SERVICE="${MATH_SERVICE:-math-system}"
BACKUP_TAG="${MATH_BACKUP_TAG:-$(date +%Y%m%d-%H%M%S)}"
RUN_SMOKE="${MATH_RUN_SMOKE:-1}"

cd "$ROOT_DIR"

if [[ -z "$REMOTE" ]]; then
  echo "MATH_SERVER_HOST is required, for example: MATH_SERVER_HOST='deploy@your-server' npm run deploy" >&2
  exit 1
fi

if [[ -z "${MATH_TEACHER_PASSWORD:-}" && "$RUN_SMOKE" == "1" ]]; then
  if [[ -t 0 ]]; then
    read -r -s -p "MATH_TEACHER_PASSWORD: " MATH_TEACHER_PASSWORD
    echo
    export MATH_TEACHER_PASSWORD
  else
    echo "MATH_TEACHER_PASSWORD is required when MATH_RUN_SMOKE=1." >&2
    exit 1
  fi
fi

echo "1/7 Local syntax check"
node --check math_multiuser_server.mjs
node --check server/appState.mjs
node --check server/assignments.mjs
node --check server/assignmentsView.mjs
node --check server/auth.mjs
node --check server/db.mjs
node --check server/learningPages.mjs
node --check server/loginLogs.mjs
node --check server/middleRouteLoader.mjs
node --check server/offlineSync.mjs
node --check server/primaryRouteLoader.mjs
node --check server/progress.mjs
node --check server/questionBank.mjs
node --check server/questionReview.mjs
node --check server/questionValidation.mjs
node --check server/questions.mjs
node --check server/reports.mjs
node --check server/routeDataLoader.mjs
node --check server/routes.mjs
node --check server/staticAssets.mjs
node --check server/studentProfiles.mjs
node --check server/students.mjs
node --check server/uiPage.mjs
node --check scripts/generate_weekly_diagnostics.mjs
node --check scripts/generate_daily_diagnostics.mjs
node --check scripts/validate_assigned_homework_nodes.mjs
node --check scripts/smoke_math_system.mjs
node --check scripts/extract_app_assets.mjs
node --check public/pwa.js

echo "2/7 Remote backup"
ssh "$REMOTE" "set -e; cd '$REMOTE_DIR'; cp math_multiuser_server.mjs math_multiuser_server.mjs.bak-$BACKUP_TAG; cp data/math-learning-db.json data/math-learning-db.json.bak-$BACKUP_TAG"

echo "3/7 Upload server and scripts"
ssh "$REMOTE" "mkdir -p '$REMOTE_DIR/scripts' '$REMOTE_DIR/assets' '$REMOTE_DIR/public' '$REMOTE_DIR/server' '$REMOTE_DIR/studentspic'"
scp math_multiuser_server.mjs "$REMOTE:$REMOTE_DIR/math_multiuser_server.mjs"
scp server/appState.mjs "$REMOTE:$REMOTE_DIR/server/appState.mjs"
scp server/assignments.mjs "$REMOTE:$REMOTE_DIR/server/assignments.mjs"
scp server/assignmentsView.mjs "$REMOTE:$REMOTE_DIR/server/assignmentsView.mjs"
scp server/auth.mjs "$REMOTE:$REMOTE_DIR/server/auth.mjs"
scp server/db.mjs "$REMOTE:$REMOTE_DIR/server/db.mjs"
scp server/learningPages.mjs "$REMOTE:$REMOTE_DIR/server/learningPages.mjs"
scp server/loginLogs.mjs "$REMOTE:$REMOTE_DIR/server/loginLogs.mjs"
scp server/middleRouteLoader.mjs "$REMOTE:$REMOTE_DIR/server/middleRouteLoader.mjs"
scp server/offlineSync.mjs "$REMOTE:$REMOTE_DIR/server/offlineSync.mjs"
scp server/primaryRouteLoader.mjs "$REMOTE:$REMOTE_DIR/server/primaryRouteLoader.mjs"
scp server/progress.mjs "$REMOTE:$REMOTE_DIR/server/progress.mjs"
scp server/questionBank.mjs "$REMOTE:$REMOTE_DIR/server/questionBank.mjs"
scp server/questionReview.mjs "$REMOTE:$REMOTE_DIR/server/questionReview.mjs"
scp server/questionValidation.mjs "$REMOTE:$REMOTE_DIR/server/questionValidation.mjs"
scp server/questions.mjs "$REMOTE:$REMOTE_DIR/server/questions.mjs"
scp server/reports.mjs "$REMOTE:$REMOTE_DIR/server/reports.mjs"
scp server/routeDataLoader.mjs "$REMOTE:$REMOTE_DIR/server/routeDataLoader.mjs"
scp server/routes.mjs "$REMOTE:$REMOTE_DIR/server/routes.mjs"
scp server/staticAssets.mjs "$REMOTE:$REMOTE_DIR/server/staticAssets.mjs"
scp server/studentProfiles.mjs "$REMOTE:$REMOTE_DIR/server/studentProfiles.mjs"
scp server/students.mjs "$REMOTE:$REMOTE_DIR/server/students.mjs"
scp server/uiPage.mjs "$REMOTE:$REMOTE_DIR/server/uiPage.mjs"
scp scripts/generate_weekly_diagnostics.mjs "$REMOTE:$REMOTE_DIR/scripts/generate_weekly_diagnostics.mjs"
scp scripts/generate_daily_diagnostics.mjs "$REMOTE:$REMOTE_DIR/scripts/generate_daily_diagnostics.mjs"
scp scripts/validate_assigned_homework_nodes.mjs "$REMOTE:$REMOTE_DIR/scripts/validate_assigned_homework_nodes.mjs"
scp scripts/smoke_math_system.mjs "$REMOTE:$REMOTE_DIR/scripts/smoke_math_system.mjs"
scp scripts/extract_app_assets.mjs "$REMOTE:$REMOTE_DIR/scripts/extract_app_assets.mjs"
if compgen -G "studentspic/*.md" > /dev/null; then
  scp studentspic/*.md "$REMOTE:$REMOTE_DIR/studentspic/"
else
  echo "No private student profile notes found; skipping studentspic upload"
fi
scp public/app.css "$REMOTE:$REMOTE_DIR/public/app.css"
scp public/app.js "$REMOTE:$REMOTE_DIR/public/app.js"
scp public/style.css "$REMOTE:$REMOTE_DIR/public/style.css"
scp public/shared.js "$REMOTE:$REMOTE_DIR/public/shared.js"
scp public/admin.js "$REMOTE:$REMOTE_DIR/public/admin.js"
scp public/student.js "$REMOTE:$REMOTE_DIR/public/student.js"
scp public/pwa.js "$REMOTE:$REMOTE_DIR/public/pwa.js"
scp public/service-worker.js "$REMOTE:$REMOTE_DIR/public/service-worker.js"
scp public/offline.html "$REMOTE:$REMOTE_DIR/public/offline.html"
scp public/manifest.webmanifest "$REMOTE:$REMOTE_DIR/public/manifest.webmanifest"
scp public/app-icon.svg "$REMOTE:$REMOTE_DIR/public/app-icon.svg"
scp public/app-icon-maskable.svg "$REMOTE:$REMOTE_DIR/public/app-icon-maskable.svg"
scp assets/math-lab-planet-map.png "$REMOTE:$REMOTE_DIR/assets/math-lab-planet-map.png"
scp assets/student-starry-bg.png "$REMOTE:$REMOTE_DIR/assets/student-starry-bg.png"

echo "4/7 Remote syntax check"
ssh "$REMOTE" "$NODE_BIN --check '$REMOTE_DIR/math_multiuser_server.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/appState.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/assignments.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/assignmentsView.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/auth.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/db.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/learningPages.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/loginLogs.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/middleRouteLoader.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/offlineSync.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/primaryRouteLoader.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/progress.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/questionBank.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/questionReview.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/questionValidation.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/questions.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/reports.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/routeDataLoader.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/routes.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/staticAssets.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/studentProfiles.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/students.mjs' && $NODE_BIN --check '$REMOTE_DIR/server/uiPage.mjs' && $NODE_BIN --check '$REMOTE_DIR/public/shared.js' && $NODE_BIN --check '$REMOTE_DIR/public/admin.js' && $NODE_BIN --check '$REMOTE_DIR/public/student.js' && $NODE_BIN --check '$REMOTE_DIR/public/pwa.js' && $NODE_BIN --check '$REMOTE_DIR/scripts/generate_weekly_diagnostics.mjs' && $NODE_BIN --check '$REMOTE_DIR/scripts/generate_daily_diagnostics.mjs' && $NODE_BIN --check '$REMOTE_DIR/scripts/validate_assigned_homework_nodes.mjs' && $NODE_BIN --check '$REMOTE_DIR/scripts/smoke_math_system.mjs' && $NODE_BIN --check '$REMOTE_DIR/scripts/extract_app_assets.mjs'"

echo "4.5/7 Validate active homework nodes"
ssh "$REMOTE" "cd '$REMOTE_DIR'; $NODE_BIN scripts/validate_assigned_homework_nodes.mjs --db data/math-learning-db.json"

echo "5/7 Restart service"
ssh "$REMOTE" "systemctl restart '$SERVICE'; sleep 3; systemctl is-active '$SERVICE'"

echo "6/7 Health check"
ssh "$REMOTE" "curl -fsS http://127.0.0.1:4180/healthz"

if [[ "$RUN_SMOKE" == "1" ]]; then
  echo "7/7 Remote smoke test"
  ssh "$REMOTE" "cd '$REMOTE_DIR'; MATH_BASE_URL='http://127.0.0.1:4180' MATH_TEACHER_USERNAME='${MATH_TEACHER_USERNAME:-stephen}' MATH_TEACHER_PASSWORD='$MATH_TEACHER_PASSWORD' MATH_TEST_STUDENT_USERNAME='${MATH_TEST_STUDENT_USERNAME:-Jason}' MATH_TEST_STUDENT_PASSWORD='${MATH_TEST_STUDENT_PASSWORD:-}' MATH_TEST_STUDENT_NAME='${MATH_TEST_STUDENT_NAME:-Jason}' $NODE_BIN scripts/smoke_math_system.mjs"
else
  echo "7/7 Smoke test skipped because MATH_RUN_SMOKE=$RUN_SMOKE"
fi

echo "Deploy complete. Backup tag: $BACKUP_TAG"
