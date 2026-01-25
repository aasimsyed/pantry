#!/bin/bash
# Run database migrations against Cloud SQL (production).
# Use this when you get "column X does not exist" errors (e.g. storage_location).
#
# Prerequisites:
#   - Cloud SQL Proxy running on localhost (e.g. port 5434)
#   - DATABASE_URL set to proxy URL (see below)
#
# Usage:
#   Terminal 1:
#     export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/pantry-manager-416004-1428ba71c020.json"
#     cloud-sql-proxy --port 5434 pantry-manager-416004:us-south1:pantry-db
#
#   Terminal 2 (from project root):
#     export DATABASE_URL='postgresql://pantry-user:YOUR_PASSWORD@localhost:5434/pantry'
#     ./scripts/run-migrations-cloudsql.sh

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

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not set${NC}"
    echo ""
    echo "Start Cloud SQL Proxy, then:"
    echo "  export DATABASE_URL='postgresql://pantry-user:YOUR_PASSWORD@localhost:5434/pantry'"
    echo "  ./scripts/run-migrations-cloudsql.sh"
    exit 1
fi

if [[ "$DATABASE_URL" == sqlite* ]]; then
    echo -e "${RED}❌ DATABASE_URL must point to PostgreSQL (Cloud SQL via proxy)${NC}"
    exit 1
fi

echo -e "${BLUE}🔄 Running migrations against Cloud SQL...${NC}"
echo ""
python3 -m src.migrations
echo ""
echo -e "${GREEN}✅ Done. Try image upload again.${NC}"
