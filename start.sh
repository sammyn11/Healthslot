#!/usr/bin/env bash
# One-command dev server for HealthSlot (macOS / Linux)
set -e
cd "$(dirname "$0")"

# Try common ways Node gets onto PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/.nvm/nvm.sh"
fi
if command -v fnm &>/dev/null; then
  eval "$(fnm env)"
fi

if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
  echo "Node.js is not installed or not in PATH."
  echo "Install LTS from https://nodejs.org or run: brew install node"
  echo "Then open Terminal, run: cd $(pwd) && ./start.sh"
  exit 1
fi

echo "Using: $(command -v node) ($(node -v))"
npm install
if [[ ! -f server/data/healthslot.db ]]; then
  echo "Seeding database..."
  npm run seed -w server || true
fi
echo ""
echo "Starting API (4000) + web app (5173)..."
echo "Open in your browser: http://127.0.0.1:5173"
echo "Press Ctrl+C to stop."
echo ""
exec npm run dev
