#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PYTHONPATH="${PYTHONPATH:-${ROOT}}"

python3 -m runtime.meta.loop_a report
python3 -m runtime.meta.loop_a propose
python3 -m runtime.meta.loop_a promote
