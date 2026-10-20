#!/bin/sh
# The repo guard checks, shared by CI (.github/workflows/ci.yml) and the
# pre-commit hook (githooks/pre-commit). Add new guards here, not in CI.
set -eu
cd "$(dirname "$0")/.."

if grep -rn --include='*.ts' --include='*.tsx' --include='*.css' -e '—' -e '–' src/; then
  echo 'Found banned em/en dash characters in src/. Use a hyphen (-) instead.'
  exit 1
fi

if grep -rniE --include='*.ts' --include='*.tsx' --include='*.css' \
    -e 'overlay' -e 'template' -e 'photo' -e 'gallery' -e 'album' \
    -e 'cutout' -e 'mask' -e 'asset' -e 'snap' src/; then
  echo 'Found glossary avoid-words in src/. Use the terms in GLOSSARY.md.'
  exit 1
fi
