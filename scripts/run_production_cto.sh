#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHONPATH="${PYTHONPATH:-${ROOT}}" python3 -m runtime.glideloop_orchestrator.main run "Production CTO: control dev CTO and validate release readiness"
