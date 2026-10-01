#!/bin/bash
# Kill any process using port 4723 (default Appium port).
# Use before "npm run e2e:full" if WDIO reports "port may already be in use".
# Typically the process is a leftover Appium from a previous run or from run-e2e-ios.sh.

PORT="${1:-4723}"
PID=$(lsof -ti:"$PORT" 2>/dev/null | head -1)

if [ -n "$PID" ]; then
  echo "Killing process on port $PORT (PID $PID)"
  kill "$PID" 2>/dev/null
  sleep 1
  if lsof -ti:"$PORT" 2>/dev/null | head -1 >/dev/null; then
    kill -9 "$PID" 2>/dev/null
    sleep 1
  fi
  if lsof -ti:"$PORT" 2>/dev/null | head -1 >/dev/null; then
    echo "Port $PORT still in use."
    exit 1
  fi
  echo "Port $PORT is free."
else
  echo "No process on port $PORT."
fi
