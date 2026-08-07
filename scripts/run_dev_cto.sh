#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE="${ROOT}/runtime/workspace"
DEV_ROOT="${WORKSPACE}/dev-cto"
MAIN_ROOT="${WORKSPACE}/production-cto"

mkdir -p "${DEV_ROOT}" "${MAIN_ROOT}"

cat > "${DEV_ROOT}/GOAL.md" <<'EOF'
# Dev CTO Goal
You are the **dev CTO**.
- Own `dev` branch improvements only.
- Do NOT touch release artifacts.
- Report status, blockers, and completed todos to production CTO.
EOF

cat > "${MAIN_ROOT}/GOAL.md" <<'EOF'
# Production CTO Goal
You are the **production CTO**.
- Control the dev CTO session.
- Validate dev branch quality before release.
- When dev is perfect, promote `dev` -> `main` as release.
EOF

PYTHONPATH="${PYTHONPATH:-${ROOT}}" python3 -m runtime.glideloop_orchestrator.main run "Dev CTO: implement next improvements on dev branch under production CTO direction"
