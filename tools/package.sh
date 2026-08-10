#!/usr/bin/env bash
# Package SCATERNET into a Chrome Web Store-ready zip.
# Includes ONLY runtime files (manifest + src + assets); excludes tools, tests,
# node_modules, .venv, .git, store assets, .genjobs.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -e "process.stdout.write(require('./manifest.json').version)")
ZIP="scaternet-v${VERSION}.zip"

rm -f "$ZIP"
zip -r -q "$ZIP" manifest.json src assets \
  -x '*/.DS_Store' -x '.DS_Store' -x '*/SOURCES.md'

echo "Built $ZIP"
unzip -l "$ZIP" | tail -n +2 | head -n 20
echo "Total size: $(du -h "$ZIP" | cut -f1)"
