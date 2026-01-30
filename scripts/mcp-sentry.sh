#!/usr/bin/env bash
# Wrapper so Sentry MCP uses SENTRY_AUTH_TOKEN from project .env (MCP expects SENTRY_ACCESS_TOKEN).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
# shellcheck source=/dev/null
source "${SCRIPT_DIR}/../.env"
set +a
export SENTRY_ACCESS_TOKEN="${SENTRY_AUTH_TOKEN}"
exec npx -y @sentry/mcp-server@latest "$@"
