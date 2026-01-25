#!/bin/bash
# Start local Postgres via Docker (same as docker-compose db).
# Use this for local dev parity with production (Cloud SQL Postgres).
#
# Usage (from project root):
#   ./scripts/start-db-local.sh
#   # Then in .env set:
#   # DATABASE_URL=postgresql://pantry_user:pantry_pass@localhost:5432/pantry_db
#   ./start-backend-local.sh

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ Run from project root${NC}"
    exit 1
fi

echo -e "${BLUE}🐘 Starting local Postgres (Docker)...${NC}"
docker-compose up -d db
echo ""

# Wait for Postgres to be ready
echo -e "${BLUE}⏳ Waiting for Postgres...${NC}"
READY=0
for _ in {1..30}; do
    if docker-compose exec -T db pg_isready -U pantry_user -d pantry_db 2>/dev/null; then
        READY=1
        echo -e "${GREEN}✅ Postgres is ready${NC}"
        break
    fi
    sleep 0.5
done
if [ "$READY" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Postgres may still be starting. Add DATABASE_URL to .env and run start-backend-local.sh.${NC}"
fi

echo ""
echo -e "${GREEN}Add to your .env:${NC}"
echo ""
echo "  DATABASE_URL=postgresql://pantry_user:pantry_pass@localhost:5433/pantry_db"
echo ""
echo -e "${BLUE}Then run: ./start-backend-local.sh${NC}"
echo ""
