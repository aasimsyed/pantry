#!/bin/bash
# Setup GitHub Secrets for CI/CD Automation
# This script helps set up EXPO_TOKEN secret for mobile app builds

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REPO="aasimsyed/pantry"

echo -e "${BLUE}🔐 GitHub Secrets Setup for Smart Pantry CI/CD${NC}"
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI is not authenticated${NC}"
    echo ""
    echo "To authenticate non-interactively:"
    echo "1. Create a GitHub Personal Access Token:"
    echo "   👉 https://github.com/settings/tokens"
    echo "   👉 Generate new token (classic)"
    echo "   👉 Scopes: repo, workflow"
    echo ""
    echo "2. Run this command:"
    echo "   echo 'YOUR_GITHUB_TOKEN' | gh auth login --with-token"
    echo ""
    read -p "Do you have a GitHub token ready? (y/n): " has_token
    
    if [ "$has_token" != "y" ] && [ "$has_token" != "Y" ]; then
        echo -e "${YELLOW}Please create a token first, then run this script again.${NC}"
        exit 1
    fi
    
    read -sp "Enter your GitHub Personal Access Token: " github_token
    echo ""
    
    echo "$github_token" | gh auth login --with-token
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ GitHub CLI authenticated successfully!${NC}"
    else
        echo -e "${RED}❌ Authentication failed${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ GitHub CLI is already authenticated${NC}"
    gh auth status
fi

echo ""
echo -e "${BLUE}📋 Setting up EXPO_TOKEN secret...${NC}"
echo ""

# Check if EXPO_TOKEN already exists
if gh secret list --repo "$REPO" | grep -q "EXPO_TOKEN"; then
    echo -e "${YELLOW}⚠️  EXPO_TOKEN secret already exists${NC}"
    read -p "Do you want to update it? (y/n): " update_choice
    if [ "$update_choice" != "y" ] && [ "$update_choice" != "Y" ]; then
        echo "Keeping existing secret."
        exit 0
    fi
fi

echo "To create an Expo access token:"
echo "   👉 https://expo.dev/accounts/aasimsyed/settings/access-tokens"
echo ""
read -sp "Enter your Expo access token: " expo_token
echo ""

if [ -z "$expo_token" ]; then
    echo -e "${RED}❌ Expo token cannot be empty${NC}"
    exit 1
fi

# Set the secret
echo -e "${BLUE}Setting EXPO_TOKEN secret...${NC}"
gh secret set EXPO_TOKEN --body "$expo_token" --repo "$REPO"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ EXPO_TOKEN secret set successfully!${NC}"
    echo ""
    echo -e "${BLUE}📱 Next steps:${NC}"
    echo "1. Push changes to trigger the workflow:"
    echo "   git push origin main"
    echo ""
    echo "2. Monitor builds at:"
    echo "   https://github.com/$REPO/actions"
    echo ""
    echo -e "${GREEN}🎉 Setup complete!${NC}"
else
    echo -e "${RED}❌ Failed to set secret${NC}"
    exit 1
fi
