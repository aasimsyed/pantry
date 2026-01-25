#!/bin/bash
# Kill and Restart Backend Server
# This script kills any process on port 8000 and starts a fresh backend

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🛑 Killing old backend process on port 8000...${NC}"

# Find and kill process on port 8000
PID=$(lsof -ti:8000 2>/dev/null | head -1)

if [ -n "$PID" ]; then
    echo -e "${YELLOW}   Found process: PID $PID${NC}"
    kill $PID 2>/dev/null || kill -9 $PID 2>/dev/null
    echo -e "${GREEN}✅ Process killed${NC}"
    sleep 1
else
    echo -e "${YELLOW}   No process found on port 8000${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Starting fresh backend server...${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "api/main.py" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    echo "Usage: cd /path/to/pantry && ./scripts/kill-and-restart-backend.sh"
    exit 1
fi

# Activate virtual environment
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found. Creating...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
fi

source venv/bin/activate

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    echo -e "${BLUE}📋 Loading environment variables from .env...${NC}"
    set -a  # Automatically export all variables
    source .env
    set +a  # Stop automatically exporting
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
else
    echo -e "${YELLOW}⚠️  No .env file found${NC}"
    echo -e "${YELLOW}💡 Create .env file with API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY)${NC}"
fi

# Initialize database
echo -e "${BLUE}🔧 Initializing database...${NC}"
python3 -c "from src.database import init_database; init_database()" || echo "⚠️  Database may already be initialized"

echo ""
echo -e "${GREEN}✅ Starting backend server on port 8000...${NC}"
echo ""
echo -e "${BLUE}📍 API will be available at:${NC}"
echo "   http://localhost:8000"
echo "   http://localhost:8000/docs (API documentation)"
echo ""
echo -e "${BLUE}📊 All server logs will appear below:${NC}"
echo ""
echo -e "${YELLOW}💡 Press Ctrl+C to stop${NC}"
echo ""
echo "─────────────────────────────────────────────────────"
echo ""

# Start the server
python3 start_server.py
