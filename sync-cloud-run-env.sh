#!/bin/bash
# Script to sync all necessary environment variables from .env to Cloud Run
# This syncs only the variables needed for the application to work

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-pantry-manager-416004}"
REGION="${GCP_REGION:-us-south1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-pantry-api}"

echo -e "${BLUE}🔄 Syncing environment variables from .env to Cloud Run...${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    exit 1
fi

# Check if gcloud is installed and configured
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    exit 1
fi

# Set the project
gcloud config set project "${PROJECT_ID}" > /dev/null 2>&1 || {
    echo -e "${RED}❌ Failed to set project. Check your GCP_PROJECT_ID${NC}"
    exit 1
}

echo -e "${BLUE}📋 Variables to sync:${NC}"
echo ""

# Required variables for the application
REQUIRED_VARS=(
    # Security & Auth
    "SECRET_KEY"
    "JWT_ALGORITHM"
    "JWT_ACCESS_TOKEN_EXPIRE_MINUTES"
    "JWT_REFRESH_TOKEN_EXPIRE_DAYS"
    
    # AI Configuration
    "OPENAI_API_KEY"
    "AI_PROVIDER"
    "AI_MODEL"
    "ANTHROPIC_API_KEY"
    
    # Database (optional - defaults to SQLite)
    "DATABASE_URL"
    
    # Optional AI settings
    "AI_TEMPERATURE"
    "AI_MAX_TOKENS"
    "AI_TIMEOUT"
    "AI_MIN_CONFIDENCE"
    
    # Optional OCR settings
    "OCR_PREFERRED_BACKEND"
    "OCR_CONFIDENCE_THRESHOLD"
    
    # Google Cloud Vision: API key or service account
    "GOOGLE_VISION_API_KEY"
    "GOOGLE_APPLICATION_CREDENTIALS"
)

# Counters
SET_COUNT=0
SKIP_COUNT=0
MISSING_COUNT=0
ENV_VARS_ARGS=""

# Process each variable
for VAR in "${REQUIRED_VARS[@]}"; do
    # Extract value from .env
    VALUE=$(grep "^${VAR}=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    if [ -z "$VALUE" ]; then
        echo -e "${YELLOW}⚠️  $VAR - Not found in .env (skipping)${NC}"
        MISSING_COUNT=$((MISSING_COUNT + 1))
        continue
    fi
    
    # Special handling for GOOGLE_APPLICATION_CREDENTIALS (file path)
    if [ "$VAR" = "GOOGLE_APPLICATION_CREDENTIALS" ] && [ -f "$VALUE" ]; then
        echo -e "${YELLOW}📄 $VAR - File path detected: $VALUE${NC}"
        echo -e "   ${YELLOW}⚠️  Note: Cloud Run needs the JSON content, not file path${NC}"
        echo -e "   ${BLUE}💡 You'll need to set this manually using Secret Manager${NC}"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        continue
    fi
    
    # Add to environment variables list
    if [ -z "$ENV_VARS_ARGS" ]; then
        ENV_VARS_ARGS="${VAR}=${VALUE}"
    else
        ENV_VARS_ARGS="${ENV_VARS_ARGS},${VAR}=${VALUE}"
    fi
    SET_COUNT=$((SET_COUNT + 1))
    echo -e "${GREEN}✅ Found $VAR${NC}"
done

# Set all variables at once
if [ -n "$ENV_VARS_ARGS" ]; then
    echo ""
    echo -e "${BLUE}📤 Setting environment variables on Cloud Run...${NC}"
    
    if gcloud run services update "${SERVICE_NAME}" \
        --region "${REGION}" \
        --update-env-vars "${ENV_VARS_ARGS}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Successfully set environment variables${NC}"
    else
        echo -e "${RED}❌ Failed to set environment variables${NC}"
        echo -e "${YELLOW}💡 You may need to set them individually:${NC}"
        echo "   gcloud run services update ${SERVICE_NAME} --region ${REGION} --set-env-vars VAR=value"
        SKIP_COUNT=$((SKIP_COUNT + SET_COUNT))
        SET_COUNT=0
    fi
else
    echo ""
    echo -e "${YELLOW}⚠️  No environment variables found in .env file${NC}"
fi

echo ""
echo -e "${BLUE}📊 Summary:${NC}"
echo -e "   ${GREEN}✅ Set: $SET_COUNT variables${NC}"
echo -e "   ${YELLOW}⚠️  Skipped: $SKIP_COUNT variables${NC}"
echo -e "   ${RED}❌ Missing: $MISSING_COUNT variables${NC}"
echo ""
echo -e "${GREEN}🚀 Cloud Run service will automatically update.${NC}"
echo ""
echo -e "${BLUE}📋 Verify with:${NC}"
echo "   gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format='yaml(spec.template.spec.containers[0].env)'"
echo ""
