#!/usr/bin/env bash
#
# Point this repo's git hooks at the versioned scripts/hooks/ directory.
#
# Run once after cloning:  bash scripts/install-hooks.sh
# (also wired to npm's `prepare` lifecycle, so `npm install` runs it for you).
#
set -euo pipefail

# Resolve the repo root so this works regardless of where it's invoked from.
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

git config core.hooksPath scripts/hooks
chmod +x scripts/hooks/* 2>/dev/null || true

echo "✅ git hooks installed (core.hooksPath → scripts/hooks)."
