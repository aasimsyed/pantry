#!/bin/bash
# Quick script to run mobile app locally with proper setup
#
# Default: no API URL set → app uses Cloud Run (works on physical device + simulator).
# Local backend: ./run-local.sh --device (Mac IP, for device) or
#                EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 ./run-local.sh (simulator).
#
# Usage: ./run-local.sh          # Cloud Run (default, works everywhere)
#        ./run-local.sh --device # Local backend on physical device (Mac IP)
#        EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 ./run-local.sh  # Local backend on simulator

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

USE_DEVICE=false
for arg in "$@"; do
  [ "$arg" = "--device" ] && USE_DEVICE=true && break
done

echo -e "${BLUE}📱 Starting Smart Pantry Mobile App Locally${NC}"
echo ""

# Check if we're in mobile directory
if [ ! -f "package.json" ] || [ ! -f "app.json" ]; then
    echo -e "${YELLOW}⚠️  Must run from mobile directory${NC}"
    echo "Usage: cd mobile && ./run-local.sh [--device]"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Detect Mac IP for physical device
MAC_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)

# Set API URL only when explicitly requested (--device or EXPO_PUBLIC_API_URL).
# Otherwise we leave it unset → app uses Cloud Run default (works on device + simulator).
if [ -n "$EXPO_PUBLIC_API_URL" ]; then
  API_URL="$EXPO_PUBLIC_API_URL"
  echo -e "${GREEN}✅ API URL: ${API_URL} (from env)${NC}"
elif [ "$USE_DEVICE" = true ]; then
  if [ -z "$MAC_IP" ]; then
    echo -e "${RED}❌ --device requires Mac IP. Could not detect (en0/en1).${NC}"
    echo "Set manually: EXPO_PUBLIC_API_URL=http://YOUR_MAC_IP:8000 ./run-local.sh"
    exit 1
  fi
  API_URL="http://${MAC_IP}:8000"
  echo -e "${GREEN}✅ API URL: ${API_URL} (local backend, physical device)${NC}"
  echo -e "${YELLOW}⚠️  Backend must be running: ./scripts/kill-and-restart-backend.sh${NC}"
else
  API_URL=""
  echo -e "${GREEN}✅ API URL: Cloud Run (default) — works on physical device & simulator${NC}"
  echo -e "${YELLOW}💡 Local backend? Simulator: EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 ./run-local.sh${NC}"
  [ -n "$MAC_IP" ] && echo -e "${YELLOW}   Device: ./run-local.sh --device${NC}"
fi
echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo "  - QR code appears in this terminal — scan with Expo Go on your phone"
echo "  - Logs appear in this terminal"
echo "  - Press 'i' for iOS Simulator"
echo "  - Press 'a' for Android Emulator"
echo "  - Press 'w' for web browser"
echo "  - Press 'r' to reload app"
echo ""
echo -e "${GREEN}🚀 Starting Expo dev server...${NC}"
echo ""

# Only set EXPO_PUBLIC_API_URL when we have a local URL; else app uses Cloud Run default
if [ -n "$API_URL" ]; then
  EXPO_PUBLIC_API_URL="${API_URL}" npx expo start --port 8082
else
  npx expo start --port 8082
fi
