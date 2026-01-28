#!/bin/bash
# Deploy Streamlit Dashboard to Cloud Run
# Usage: ./deploy-dashboard-cloud-run.sh

set -e

# Configuration (update these)
GCP_PROJECT_ID="${GCP_PROJECT_ID:-pantry-manager-416004}"
GCP_REGION="${GCP_REGION:-us-south1}"
SERVICE_NAME="${SERVICE_NAME:-pantry-dashboard}"
IMAGE_NAME="gcr.io/${GCP_PROJECT_ID}/${SERVICE_NAME}"

echo "🚀 Deploying Streamlit Dashboard to Cloud Run"
echo "Project: ${GCP_PROJECT_ID}"
echo "Region: ${GCP_REGION}"
echo "Service: ${SERVICE_NAME}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Authenticate if needed
echo "🔐 Checking authentication..."
gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 || {
    echo "⚠️  Not authenticated. Running gcloud auth login..."
    gcloud auth login
}

# Set project
echo "📁 Setting project..."
gcloud config set project "${GCP_PROJECT_ID}"

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com --quiet

# Build Docker image
echo "🏗️  Building Docker image..."
cd "$(dirname "$0")"
gcloud builds submit --config=dashboard/cloudbuild.yaml .

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE_NAME}:latest" \
    --platform managed \
    --region "${GCP_REGION}" \
    --allow-unauthenticated \
    --port 8501 \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --set-env-vars API_BASE_URL="https://pantry-api-154407938924.us-south1.run.app"

# Get the service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --platform managed \
    --region "${GCP_REGION}" \
    --format 'value(status.url)')

echo ""
echo "✅ Dashboard deployed successfully!"
echo "🌐 URL: ${SERVICE_URL}"
echo ""
echo "💡 To update environment variables:"
echo "   gcloud run services update ${SERVICE_NAME} --region ${GCP_REGION} --set-env-vars KEY=VALUE"
echo ""
echo "💡 To view logs:"
echo "   gcloud run services logs tail ${SERVICE_NAME} --region ${GCP_REGION}"
