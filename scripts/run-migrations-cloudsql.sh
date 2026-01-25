#!/bin/bash
# Initialize production DB (create all tables + migrations) against Cloud SQL.
# Use when you get "inventory_items does not exist", "column X does not exist", etc.
#
# Prerequisites:
#   - Cloud SQL Proxy running on localhost (default port 5434)
#   - DATABASE_URL set, or .env.production with socket URL (we rewrite to proxy)
#
# Usage:
#   Terminal 1:
#     export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/pantry-manager-416004-1428ba71c020.json"
#     cloud-sql-proxy --port 5434 pantry-manager-416004:us-south1:pantry-db
#     # If "address already in use": lsof -ti:5434 | xargs kill  OR  use port 5435:
#     CLOUD_SQL_PROXY_PORT=5435 cloud-sql-proxy --port 5435 pantry-manager-416004:us-south1:pantry-db
#
#   Terminal 2 (from project root):
#     ./scripts/run-migrations-cloudsql.sh
#     # If using port 5435: CLOUD_SQL_PROXY_PORT=5435 ./scripts/run-migrations-cloudsql.sh

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ ! -f "api/main.py" ]; then
    echo -e "${RED}❌ Run from project root${NC}"
    exit 1
fi

# Load .env / .env.production so DATABASE_URL can come from there
[ -f .env ]          && set -a && source .env          && set +a
[ -f .env.production ] && set -a && source .env.production && set +a

# Proxy port (default 5434). Use 5435 etc. if 5434 is in use.
PROXY_PORT="${CLOUD_SQL_PROXY_PORT:-5434}"

# If DATABASE_URL uses Cloud Run socket (host=/cloudsql/...), rewrite for proxy (localhost:PORT)
if [[ -n "$DATABASE_URL" && "$DATABASE_URL" == *"host=/cloudsql/"* ]]; then
    PROXY_URL="${DATABASE_URL%%\?*}"
    PROXY_URL="${PROXY_URL/@\//@localhost:${PROXY_PORT}/}"
    DATABASE_URL="$PROXY_URL"
    echo -e "${BLUE}Using Cloud SQL proxy URL from .env.production (port ${PROXY_PORT})${NC}"
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not set${NC}"
    echo ""
    echo "1. Start Cloud SQL Proxy (terminal 1):"
    echo "   export GOOGLE_APPLICATION_CREDENTIALS=\"\$(pwd)/pantry-manager-416004-1428ba71c020.json\""
    echo "   cloud-sql-proxy --port 5434 pantry-manager-416004:us-south1:pantry-db"
    echo "   (If 5434 in use: lsof -ti:5434 | xargs kill  OR  CLOUD_SQL_PROXY_PORT=5435 cloud-sql-proxy --port 5435 ...)"
    echo ""
    echo "2. Run (from project root): ./scripts/run-migrations-cloudsql.sh"
    echo "   (If using port 5435: CLOUD_SQL_PROXY_PORT=5435 ./scripts/run-migrations-cloudsql.sh)"
    exit 1
fi

if [[ "$DATABASE_URL" == sqlite* ]]; then
    echo -e "${RED}❌ DATABASE_URL must point to PostgreSQL (Cloud SQL via proxy)${NC}"
    exit 1
fi

# Use project venv so sqlalchemy etc. are available
if [ -d "venv" ]; then
    set -a && source venv/bin/activate && set +a
elif [ -d ".venv" ]; then
    set -a && source .venv/bin/activate && set +a
else
    echo -e "${RED}❌ No venv or .venv found. Create one: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt${NC}"
    exit 1
fi

echo -e "${BLUE}🔄 Initializing Cloud SQL (create tables + migrations)...${NC}"
echo ""
python3 -c "from src.database import init_database; init_database()"
echo ""
echo -e "${GREEN}✅ Done. Try the app again.${NC}"
