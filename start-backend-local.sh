#!/bin/bash
# Start local backend for mobile app development

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Smart Pantry Backend Locally${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "api/main.py" ]; then
    echo -e "${YELLOW}⚠️  Must run from project root${NC}"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found. Creating...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
fi

# Activate virtual environment
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

# Install dependencies if needed
if [ ! -d "venv/lib/python*/site-packages/fastapi" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    pip install -q -r requirements.txt
    echo -e "${GREEN}✅ Dependencies installed${NC}"
fi

echo -e "${BLUE}🔧 Initializing database...${NC}"
python3 -c "from src.database import init_database; init_database()" || echo "⚠️  Database may already be initialized"

echo ""
echo -e "${GREEN}✅ Starting backend server...${NC}"
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
