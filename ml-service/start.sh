#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# macOS: deps were installed for Command Line Tools Python 3.9, not Homebrew 3.13.
if [[ -x "/Library/Developer/CommandLineTools/usr/bin/python3" ]]; then
  PYTHON="/Library/Developer/CommandLineTools/usr/bin/python3"
elif command -v python3.9 >/dev/null 2>&1; then
  PYTHON="python3.9"
else
  PYTHON="python3"
fi

echo "Using: $("$PYTHON" --version)"
exec "$PYTHON" -m uvicorn app.main:app --reload --port 8100
