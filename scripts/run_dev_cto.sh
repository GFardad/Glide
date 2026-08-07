#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHONPATH="${PYTHONPATH:-${ROOT}}" python3 -m runtime.dev_env dev
