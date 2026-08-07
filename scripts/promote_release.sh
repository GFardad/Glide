#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

if [[ "$(git branch --show-current)" != "dev" ]]; then
  echo "Run this from the dev branch." >&2
  exit 1
fi

read -rp "Promote current dev branch to release/main? (yes/no) " answer
if [[ "${answer}" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

read -rp "Release tag (default release-$(date +%Y.%m.%d)): " tag
tag="${tag:-release-$(date +%Y.%m.%d)}"

PYTHONPATH="${PYTHONPATH:-${ROOT}}" python3 -m runtime.dev_env promote --tag "${tag}"
echo "Release ${tag} promoted to main."
