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

git checkout main
git merge dev --no-edit
git tag -a "release-$(date +%Y.%m.%d-%H%M)" -m "Release promoted from dev"
git push origin main --follow-tags
git checkout dev

echo "Release promoted to main."
