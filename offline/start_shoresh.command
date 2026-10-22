#!/bin/sh
# Double-click to run Shoresh on this Mac. It opens in your browser.
cd "$(dirname "$0")" || exit 1
if ! python3 -c 'import http.server' >/dev/null 2>&1; then
  echo
  echo "  Shoresh needs Python 3, which isn't set up on this Mac yet."
  echo "  Install it from https://www.python.org/downloads/macos/"
  echo "  and double-click start_shoresh.command again."
  echo
  exit 1
fi
exec python3 serve.py
