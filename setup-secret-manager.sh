#!/bin/bash
# Script to set up Secret Manager and migrate sensitive values from environment variables

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="${GCP_PROJECT_ID:-pantry-manager-416004}"
REGION="${GCP_REGION:-us-south1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-pantry-api}"

echo -e "${BLUE}🔐 Setting up Secret Manager for Cloud Run...${NC}"
echo ""

# Enable Secret Manager API
echo -e "${BLUE}🔧 Enabling Secret Manager API...${NC}"
gcloud services enable secretmanager.googleapis.com --project "${PROJECT_ID}"

# Get project number for service account
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo -e "${BLUE}📋 Getting current environment variables...${NC}"
# Get current values from Cloud Run
CURRENT_ENV=$(gcloud run services describe "${SERVICE_NAME}" \
    --region "${REGION}" \
    --format="yaml(spec.template.spec.containers[0].env)" \
    --project "${PROJECT_ID}" 2>/dev/null || echo "")

# Extract SECRET_KEY
SECRET_KEY=$(echo "$CURRENT_ENV" | grep -A 1 "name: SECRET_KEY" | grep "value:" | awk '{print $2}' || echo "")
OPENAI_KEY=$(echo "$CURRENT_ENV" | grep -A 1 "name: OPENAI_API_KEY" | grep "value:" | awk '{print $2}' || echo "")

if [ -z "$SECRET_KEY" ]; then
    echo -e "${YELLOW}⚠️  SECRET_KEY not found in current environment variables${NC}"
    read -p "Enter SECRET_KEY (or press Enter to skip): " SECRET_KEY
fi

if [ -z "$OPENAI_KEY" ]; then
    echo -e "${YELLOW}⚠️  OPENAI_API_KEY not found in current environment variables${NC}"
    read -p "Enter OPENAI_API_KEY (or press Enter to skip): " OPENAI_KEY
fi

# Create secrets
if [ -n "$SECRET_KEY" ]; then
    echo -e "${BLUE}🔐 Creating secret-key secret...${NC}"
    if gcloud secrets describe secret-key --project "${PROJECT_ID}" &>/dev/null; then
        echo -e "${YELLOW}⚠️  Secret 'secret-key' already exists. Updating version...${NC}"
        echo -n "$SECRET_KEY" | gcloud secrets versions add secret-key --data-file=- --project "${PROJECT_ID}"
    else
        echo -n "$SECRET_KEY" | gcloud secrets create secret-key --data-file=- --project "${PROJECT_ID}"
    fi
    
    # Grant Cloud Run access
    echo -e "${BLUE}🔑 Granting Cloud Run access to secret-key...${NC}"
    gcloud secrets add-iam-policy-binding secret-key \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" \
        --project "${PROJECT_ID}" > /dev/null 2>&1 || true
    
    echo -e "${GREEN}✅ secret-key secret created${NC}"
fi

if [ -n "$OPENAI_KEY" ]; then
    echo -e "${BLUE}🔐 Creating openai-api-key secret...${NC}"
    if gcloud secrets describe openai-api-key --project "${PROJECT_ID}" &>/dev/null; then
        echo -e "${YELLOW}⚠️  Secret 'openai-api-key' already exists. Updating version...${NC}"
        echo -n "$OPENAI_KEY" | gcloud secrets versions add openai-api-key --data-file=- --project "${PROJECT_ID}"
    else
        echo -n "$OPENAI_KEY" | gcloud secrets create openai-api-key --data-file=- --project "${PROJECT_ID}"
    fi
    
    # Grant Cloud Run access
    echo -e "${BLUE}🔑 Granting Cloud Run access to openai-api-key...${NC}"
    gcloud secrets add-iam-policy-binding openai-api-key \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" \
        --project "${PROJECT_ID}" > /dev/null 2>&1 || true
    
    echo -e "${GREEN}✅ openai-api-key secret created${NC}"
fi

# Update Cloud Run service to use secrets
echo ""
echo -e "${BLUE}🚀 Updating Cloud Run service to use secrets...${NC}"

SECRETS_ARGS=""
if [ -n "$SECRET_KEY" ]; then
    SECRETS_ARGS="SECRET_KEY=secret-key:latest"
fi

if [ -n "$OPENAI_KEY" ]; then
    if [ -n "$SECRETS_ARGS" ]; then
        SECRETS_ARGS="${SECRETS_ARGS},OPENAI_API_KEY=openai-api-key:latest"
    else
        SECRETS_ARGS="OPENAI_API_KEY=openai-api-key:latest"
    fi
fi

if [ -n "$SECRETS_ARGS" ]; then
    gcloud run services update "${SERVICE_NAME}" \
        --region "${REGION}" \
        --update-secrets "${SECRETS_ARGS}" \
        --project "${PROJECT_ID}"
    
    echo -e "${GREEN}✅ Cloud Run service updated to use Secret Manager${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Note: Environment variables for these secrets will be removed automatically${NC}"
    echo -e "${YELLOW}⚠️  The secrets will be accessible via the same environment variable names${NC}"
else
    echo -e "${YELLOW}⚠️  No secrets to configure${NC}"
fi

echo ""
echo -e "${GREEN}✅ Secret Manager setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 To view secrets:${NC}"
echo "   gcloud secrets list --project ${PROJECT_ID}"
echo ""
echo -e "${BLUE}📋 To view secret versions:${NC}"
echo "   gcloud secrets versions list secret-key --project ${PROJECT_ID}"
echo "   gcloud secrets versions list openai-api-key --project ${PROJECT_ID}"
