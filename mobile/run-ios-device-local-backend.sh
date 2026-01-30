#!/usr/bin/env bash
# Build and run the app on a connected iPhone using the local dev backend.
# Prereq: iPhone connected via USB, backend running on this Mac (e.g. port 8000).
#
# Usage: cd mobile && ./run-ios-device-local-backend.sh
#
# The app will use EXPO_PUBLIC_API_URL=http://<YOUR_MAC_IP>:8000 so the phone
# can reach your local backend. Ensure the backend is running before launching.

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd "$(dirname "$0")"

if [ ! -f "package.json" ] || [ ! -f "app.json" ]; then
  echo -e "${RED}Must run from mobile directory${NC}"
  echo "Usage: cd mobile && ./run-ios-device-local-backend.sh"
  exit 1
fi

# Mac IP so the iPhone can reach the local backend (iPhone cannot use localhost)
MAC_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
if [ -z "$MAC_IP" ]; then
  echo -e "${RED}Could not detect Mac IP (en0/en1).${NC}"
  echo "Set manually: EXPO_PUBLIC_API_URL=http://YOUR_MAC_IP:8000 npx expo run:ios --device"
  exit 1
fi

API_URL="http://${MAC_IP}:8000"
export EXPO_PUBLIC_API_URL="$API_URL"

echo -e "${BLUE}Build and run on iPhone (local backend)${NC}"
echo ""
echo -e "${GREEN}API URL: ${API_URL}${NC}"
echo -e "${YELLOW}Ensure backend is running on this Mac (e.g. start_server.py or ./scripts/kill-and-restart-backend.sh from repo root).${NC}"
echo ""

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
fi

# Build and run on connected device (expo run:ios --device runs prebuild + pod install + xcodebuild + install)
echo -e "${GREEN}Building and installing on connected iPhone...${NC}"
npx expo run:ios --device

echo ""
echo -e "${GREEN}Done. App should be launching on your iPhone.${NC}"
echo "Backend: $API_URL"
