#!/bin/bash

# Smart Pantry - Startup Script
# Starts both FastAPI backend and Streamlit frontend

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Smart Pantry Application...${NC}"
echo ""

# Check if virtual environment is activated
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo -e "${YELLOW}⚠️  Warning: Virtual environment not detected${NC}"
    echo "   Activating virtual environment..."
    if [ -f ~/.venv/bin/activate ]; then
        source ~/.venv/bin/activate
    elif [ -f venv/bin/activate ]; then
        source venv/bin/activate
    else
        echo -e "${YELLOW}   Could not find virtual environment. Make sure it's activated.${NC}"
    fi
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if API server is already running
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  Port 8000 is already in use (API server may be running)${NC}"
    read -p "   Kill existing process? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        lsof -ti:8000 | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        echo "   Exiting. Please stop the existing server first."
        exit 1
    fi
fi

# Check if Streamlit is already running
if lsof -Pi :8501 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  Port 8501 is already in use (Streamlit may be running)${NC}"
    read -p "   Kill existing process? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        lsof -ti:8501 | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        echo "   Exiting. Please stop the existing server first."
        exit 1
    fi
fi

# Create logs directory
mkdir -p logs

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down servers...${NC}"
    kill $API_PID $STREAMLIT_PID 2>/dev/null || true
    wait $API_PID $STREAMLIT_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Servers stopped${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Start FastAPI server
echo -e "${BLUE}📡 Starting FastAPI backend on http://localhost:8000${NC}"
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload > logs/api.log 2>&1 &
API_PID=$!

# Wait a moment for API to start
sleep 2

# Check if API started successfully
if ! kill -0 $API_PID 2>/dev/null; then
    echo -e "${YELLOW}❌ Failed to start API server${NC}"
    cat logs/api.log
    exit 1
fi

# Start Streamlit dashboard
echo -e "${BLUE}🎨 Starting Streamlit dashboard on http://localhost:8501${NC}"
streamlit run dashboard/app.py > logs/streamlit.log 2>&1 &
STREAMLIT_PID=$!

# Wait a moment for Streamlit to start
sleep 3

# Check if Streamlit started successfully
if ! kill -0 $STREAMLIT_PID 2>/dev/null; then
    echo -e "${YELLOW}❌ Failed to start Streamlit${NC}"
    cat logs/streamlit.log
    kill $API_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Both servers started successfully!${NC}"
echo ""
echo -e "${BLUE}📍 Access points:${NC}"
echo -e "   API:      ${GREEN}http://localhost:8000${NC}"
echo -e "   API Docs: ${GREEN}http://localhost:8000/docs${NC}"
echo -e "   Dashboard: ${GREEN}http://localhost:8501${NC}"
echo ""
echo -e "${YELLOW}📝 Logs:${NC}"
echo "   API:      logs/api.log"
echo "   Streamlit: logs/streamlit.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Wait for both processes
wait $API_PID $STREAMLIT_PID

