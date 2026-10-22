#!/bin/sh
# Double-click to stop Shoresh.
cd "$(dirname "$0")" || exit 1
python3 serve.py --stop
