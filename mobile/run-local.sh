#!/bin/bash
# Quick script to run mobile app locally with proper setup

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📱 Starting Smart Pantry Mobile App Locally${NC}"
echo ""

# Check if we're in mobile directory
if [ ! -f "package.json" ] || [ ! -f "app.json" ]; then
    echo -e "${YELLOW}⚠️  Must run from mobile directory${NC}"
    echo "Usage: cd mobile && ./run-local.sh"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Set API URL: default to local backend for development (override with EXPO_PUBLIC_API_URL for Cloud Run)
API_URL="${EXPO_PUBLIC_API_URL:-http://localhost:8000}"

# Detect Mac IP for physical device tip (localhost doesn't work on real devices)
MAC_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)

echo -e "${GREEN}✅ API URL: ${API_URL}${NC}"
if [ -n "$MAC_IP" ]; then
  echo -e "${YELLOW}📱 Physical device? Use: EXPO_PUBLIC_API_URL=http://${MAC_IP}:8000 ./run-local.sh${NC}"
fi
echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo "  - QR code appears in this terminal — scan with Expo Go on your phone"
echo "  - Logs appear in this terminal"
echo "  - Press 'i' for iOS Simulator"
echo "  - Press 'a' for Android Emulator"
echo "  - Press 'w' for web browser"
echo "  - Press 'j' to open React Native Debugger"
echo "  - Press 'r' to reload app"
echo "  - Press 'm' to toggle menu"
echo ""
echo -e "${BLUE}📚 For full guide, see: LOCAL_DEVELOPMENT.md${NC}"
echo ""
echo -e "${GREEN}🚀 Starting Expo dev server...${NC}"
echo ""

# Start Expo with API URL (use 8082 if 8081 is taken by another Expo project)
EXPO_PUBLIC_API_URL="${API_URL}" npx expo start --port 8082
