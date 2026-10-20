#!/bin/sh
# The repo guard checks, shared by CI (.github/workflows/ci.yml) and the
# pre-commit hook (githooks/pre-commit). Add new guards here, not in CI.
set -eu
cd "$(dirname "$0")/.."

GUARD_PATHS="src/ e2e/ playwright.config.ts"

if grep -rn --include='*.ts' --include='*.tsx' --include='*.css' -e '—' -e '–' $GUARD_PATHS; then
  echo 'Found banned em/en dash characters in src/, e2e/, playwright.config.ts. Use a hyphen (-) instead.'
  exit 1
fi

if grep -rniE --include='*.ts' --include='*.tsx' --include='*.css' \
    -e 'overlay' -e 'template' -e 'photo' -e 'gallery' -e 'album' \
    -e 'cutout' -e 'mask' -e 'asset' -e 'snap' $GUARD_PATHS; then
  echo 'Found glossary avoid-words in src/, e2e/, or playwright.config.ts. Use the terms in GLOSSARY.md.'
  exit 1
fi

