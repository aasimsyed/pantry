#!/bin/bash
# Cloud Run Deployment Script for Smart Pantry Backend
# This script builds and deploys the backend to Google Cloud Run

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Environment variables can be overridden via command line
PROJECT_ID="${GCP_PROJECT_ID:-pantry-manager-416004}"
REGION="${GCP_REGION:-us-south1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-pantry-api}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "${BLUE}🚀 Deploying Smart Pantry Backend to Cloud Run${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Install it from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Set the project
echo -e "${BLUE}📋 Setting GCP project to ${PROJECT_ID}...${NC}"
gcloud config set project "${PROJECT_ID}" || {
    echo -e "${RED}❌ Failed to set project. Check your GCP_PROJECT_ID${NC}"
    exit 1
}

# Enable required APIs
echo -e "${BLUE}🔧 Enabling required Google Cloud APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build the Docker image using Cloud Build
echo -e "${BLUE}🏗️  Building Docker image using Cloud Build...${NC}"
gcloud builds submit --tag "${IMAGE_NAME}" . || {
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
}

# Deploy to Cloud Run
echo -e "${BLUE}🚢 Deploying to Cloud Run...${NC}"
gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE_NAME}" \
    --platform managed \
    --region "${REGION}" \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 || {
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
}

# Get the service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --platform managed \
    --region "${REGION}" \
    --format 'value(status.url)')

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""
echo -e "${BLUE}📍 Service URL: ${GREEN}${SERVICE_URL}${NC}"
echo -e "${BLUE}📚 API Docs: ${GREEN}${SERVICE_URL}/docs${NC}"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "1. Set environment variables:"
echo "   gcloud run services update ${SERVICE_NAME} --region ${REGION} --set-env-vars DATABASE_URL=..."
echo ""
echo "2. Or use Secret Manager for sensitive values:"
echo "   gcloud secrets create pantry-secrets --data-file=-"
echo "   gcloud run services update ${SERVICE_NAME} --region ${REGION} \\"
echo "     --update-secrets=DATABASE_URL=pantry-secrets:latest"
echo ""
echo "3. Update CORS settings in api/config.py to include: ${SERVICE_URL}"
echo ""
