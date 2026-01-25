#!/bin/bash
# Build and Deploy iOS App to TestFlight
# This script builds the iOS app using EAS and optionally submits it to TestFlight
#
# Usage:
#   ./build-and-deploy-ios.sh          # Interactive mode (prompts for submission)
#   ./build-and-deploy-ios.sh --auto   # Automated mode (no prompts, auto-submits)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
AUTO_MODE=false
if [[ "$1" == "--auto" ]] || [[ "$1" == "-a" ]]; then
    AUTO_MODE=true
fi

if [ "$AUTO_MODE" = true ]; then
    echo -e "${BLUE}🚀 Automated Build and Deploy Smart Pantry iOS App to TestFlight${NC}"
else
    echo -e "${BLUE}🚀 Building and Deploying Smart Pantry iOS App to TestFlight${NC}"
fi
echo ""

# Check if we're in the mobile directory
if [ ! -f "package.json" ] || [ ! -f "app.json" ]; then
    echo -e "${RED}❌ Error: Must run from mobile directory${NC}"
    echo "Usage: cd mobile && ./build-and-deploy-ios.sh [--auto]"
    exit 1
fi

# Determine EAS CLI command (prefer global, fallback to npx)
if command -v eas &> /dev/null; then
    EAS_CMD="eas"
elif npx --yes eas-cli --version &> /dev/null 2>&1; then
    EAS_CMD="npx --yes eas-cli"
else
    if [ "$AUTO_MODE" = true ]; then
        # Auto mode: use npx without prompting
        echo -e "${YELLOW}⚠️  EAS CLI not found. Using npx...${NC}"
        EAS_CMD="npx --yes eas-cli"
    else
        # Interactive mode: prompt for installation
        echo -e "${YELLOW}⚠️  EAS CLI not found. Installing...${NC}"
        echo ""
        echo "Choose an installation method:"
        echo "1. Install globally (recommended): npm install -g eas-cli"
        echo "2. Use npx (no installation needed): Will use npx eas-cli"
        echo ""
        read -p "Choose option (1 or 2) [default: 2]: " install_choice
        install_choice=${install_choice:-2}
        
        if [ "$install_choice" == "1" ]; then
            npm install -g eas-cli
            EAS_CMD="eas"
        else
            EAS_CMD="npx --yes eas-cli"
        fi
    fi
fi

echo -e "${BLUE}📋 Using EAS CLI: ${EAS_CMD}${NC}"
${EAS_CMD} --version

echo ""
if [ "$AUTO_MODE" = true ]; then
    echo -e "${BLUE}📦 Building iOS app for production...${NC}"
    echo "This will automatically increment build number and submit to TestFlight."
else
    echo -e "${BLUE}📦 Building iOS app for production...${NC}"
    echo "This will create a production build configured for TestFlight."
fi
echo ""

# Build iOS app with production profile
${EAS_CMD} build --platform ios --profile production --non-interactive

echo ""
echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo ""

# Determine if we should submit to TestFlight
SHOULD_SUBMIT=false

if [ "$AUTO_MODE" = true ]; then
    # Auto mode: always submit
    SHOULD_SUBMIT=true
else
    # Interactive mode: prompt user
    echo -e "${YELLOW}📤 Submit to TestFlight?${NC}"
    read -p "Do you want to submit this build to TestFlight? (y/n) [default: y]: " submit_choice
    submit_choice=${submit_choice:-y}
    
    if [ "$submit_choice" == "y" ] || [ "$submit_choice" == "Y" ]; then
        SHOULD_SUBMIT=true
    fi
fi

if [ "$SHOULD_SUBMIT" = true ]; then
    echo ""
    echo -e "${BLUE}🚀 Submitting to TestFlight...${NC}"
    echo ""
    
    # Submit to TestFlight (use --latest flag in auto mode)
    if [ "$AUTO_MODE" = true ]; then
        ${EAS_CMD} submit --platform ios --non-interactive --latest
    else
        ${EAS_CMD} submit --platform ios --non-interactive
    fi
    
    echo ""
    echo -e "${GREEN}✅ Build submitted to TestFlight successfully!${NC}"
    echo ""
    echo -e "${BLUE}📱 Next steps:${NC}"
    echo "1. Check your email for TestFlight notifications"
    echo "2. View builds in App Store Connect: https://appstoreconnect.apple.com/apps/6755445323/testflight/ios"
    echo "3. Wait for Apple to process the build (usually 5-10 minutes)"
    echo "4. Add testers in TestFlight when build is ready"
else
    echo ""
    echo -e "${YELLOW}💡 To submit later, run:${NC}"
    echo "  ${EAS_CMD} submit --platform ios --latest"
fi

echo ""
echo -e "${GREEN}🎉 Done!${NC}"
