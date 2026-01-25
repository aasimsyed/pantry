# Cloud Run Deployment Guide

This guide explains how to deploy the Smart Pantry backend to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account**: Sign up at https://cloud.google.com
2. **Google Cloud CLI**: Install `gcloud` CLI
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Or download from: https://cloud.google.com/sdk/docs/install
   ```
3. **Docker**: Install Docker Desktop (optional, Cloud Build will build for you)
   ```bash
   # macOS
   brew install docker
   ```
4. **Authentication**: Log in to Google Cloud
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

## Quick Start

### 1. Set Up Your Project

```bash
# Set your GCP project ID
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"  # or your preferred region

# Create a new project (optional)
gcloud projects create ${GCP_PROJECT_ID}

# Set as current project
gcloud config set project ${GCP_PROJECT_ID}
```

### 2. Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 3. Deploy Using the Script

Make the deployment script executable:

```bash
chmod +x deploy-cloud-run.sh
```

Update the configuration in the script or set environment variables:

```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"
export CLOUD_RUN_SERVICE="pantry-api"

# Run the deployment
./deploy-cloud-run.sh
```

### 4. Manual Deployment (Alternative)

If you prefer to deploy manually:

```bash
# Build and push the image
gcloud builds submit --tag gcr.io/${GCP_PROJECT_ID}/pantry-api

# Deploy to Cloud Run
gcloud run deploy pantry-api \
    --image gcr.io/${GCP_PROJECT_ID}/pantry-api \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300
```

## Configuration

### Environment Variables

Set environment variables for your Cloud Run service:

```bash
gcloud run services update pantry-api \
    --region us-central1 \
    --set-env-vars DATABASE_URL="postgresql://user:pass@host:5432/pantry" \
    --set-env-vars OPENAI_API_KEY="your-key" \
    --set-env-vars ANTHROPIC_API_KEY="your-key"
```

### Using Secret Manager (Recommended for Sensitive Data)

1. Create secrets:

```bash
# Create a secret for database URL
echo -n "postgresql://user:pass@host:5432/pantry" | \
    gcloud secrets create database-url --data-file=-

# Create secret for API keys
echo -n "your-openai-key" | \
    gcloud secrets create openai-api-key --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding database-url \
    --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding openai-api-key \
    --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

2. Update the service to use secrets:

```bash
gcloud run services update pantry-api \
    --region us-central1 \
    --update-secrets DATABASE_URL=database-url:latest,OPENAI_API_KEY=openai-api-key:latest
```

### Google Vision on Cloud Run (no key required)

When the API runs on Cloud Run, **you do not need** `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_VISION_API_KEY`. The app uses **Application Default Credentials (ADC)** from the Cloud Run service account.

1. **Enable the Vision API** (if not already):
   ```bash
   gcloud services enable vision.googleapis.com
   ```

2. **Ensure the Cloud Run service account can call Vision.** The default Compute Engine service account often works once the API is enabled. If Vision calls fail with permission errors, grant a suitable role (e.g. **Cloud ML Developer** or project **Editor**) to the service account used by the Cloud Run service. See [Vision API authentication](https://cloud.google.com/vision/docs/authentication).

3. **Do not set** `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_VISION_API_KEY` for the Cloud Run service. Vision will use ADC automatically.

4. **Local dev** still needs a key file (`GOOGLE_APPLICATION_CREDENTIALS`) or API key, since there is no Cloud Run identity.

### Database Configuration

For production, use Cloud SQL (PostgreSQL) instead of SQLite:

1. Create a Cloud SQL instance:

```bash
gcloud sql instances create pantry-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1
```

2. Create a database:

```bash
gcloud sql databases create pantry --instance=pantry-db
```

3. Create a user:

```bash
gcloud sql users create pantry-user \
    --instance=pantry-db \
    --password=YOUR_SECURE_PASSWORD
```

4. Get connection name:

```bash
gcloud sql instances describe pantry-db --format="value(connectionName)"
```

5. Connect Cloud Run to Cloud SQL:

```bash
gcloud run services update pantry-api \
    --region us-central1 \
    --add-cloudsql-instances=PROJECT_ID:REGION:pantry-db \
    --set-env-vars DATABASE_URL="postgresql://pantry-user:YOUR_PASSWORD@/pantry?host=/cloudsql/PROJECT_ID:REGION:pantry-db"
```

## Important Configuration Details

### Port Configuration

Cloud Run sets the `PORT` environment variable automatically (typically 8080). The `start_server.py` script reads this variable:

```python
port = int(os.environ.get("PORT", 8000))
```

If your service uses port 8080, update the Dockerfile's EXPOSE directive (optional, but good practice):

```dockerfile
EXPOSE 8080
```

### CORS Configuration

After deployment, update `api/config.py` to include your Cloud Run service URL in the `cors_origins` list:

```python
cors_origins: List[str] = [
    # ... existing origins ...
    "https://pantry-api-xxxxx-uc.a.run.app",  # Your Cloud Run URL
]
```

Or set it via environment variable:

```bash
gcloud run services update pantry-api \
    --region us-central1 \
    --set-env-vars API_CORS_ORIGINS='["https://pantry-api-xxxxx-uc.a.run.app","https://your-frontend.vercel.app"]'
```

### Resource Limits

Adjust resources based on your needs:

```bash
gcloud run services update pantry-api \
    --region us-central1 \
    --memory 1Gi \
    --cpu 2 \
    --max-instances 20 \
    --min-instances 1  # Keep warm to avoid cold starts
```

### Autoscaling

Cloud Run automatically scales based on traffic:
- **Min instances**: 0 (scales to zero when idle)
- **Max instances**: 10 (default, can be increased)
- **Concurrency**: 80 requests per instance (default)

Update these values:

```bash
gcloud run services update pantry-api \
    --region us-central1 \
    --min-instances 0 \
    --max-instances 10
```

## Monitoring and Logs

### View Logs

```bash
# Real-time logs
gcloud run services logs tail pantry-api --region us-central1

# Recent logs
gcloud run services logs read pantry-api --region us-central1 --limit 50
```

### Set Up Monitoring

1. Enable Cloud Monitoring and Cloud Logging (enabled by default)
2. View metrics in Cloud Console: https://console.cloud.google.com/run
3. Set up alerts in Cloud Monitoring

## Continuous Deployment (CI/CD)

### Using Cloud Build with GitHub

1. Connect your repository to Cloud Build:

```bash
gcloud source repos create pantry-backend
gcloud source repos clone pantry-backend
```

2. Create `cloudbuild.yaml`:

```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/pantry-api', '.']
  
  # Push the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/pantry-api']
  
  # Deploy container image to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'pantry-api'
      - '--image'
      - 'gcr.io/$PROJECT_ID/pantry-api'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'

images:
  - 'gcr.io/$PROJECT_ID/pantry-api'
```

3. Trigger builds on push:

```bash
gcloud builds triggers create github \
    --repo-name=pantry \
    --repo-owner=YOUR_GITHUB_USERNAME \
    --branch-pattern="^main$" \
    --build-config=cloudbuild.yaml
```

## Run Migrations Against Cloud SQL

If you get **`column "storage_location" of relation "inventory_items" does not exist`** (or other schema errors) when using the API:

1. Start Cloud SQL Proxy (from project root):
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/pantry-manager-416004-1428ba71c020.json"
   cloud-sql-proxy --port 5434 pantry-manager-416004:us-south1:pantry-db
   ```
2. In another terminal, run migrations (from project root):
   ```bash
   export DATABASE_URL='postgresql://pantry-user:YOUR_PASSWORD@localhost:5434/pantry'
   ./scripts/run-migrations-cloudsql.sh
   ```
   Or: `python -m src.migrations`
3. Restart the app or redeploy. Image upload and inventory INSERTs should work.

Cloud Run also runs migrations on startup (`init_database`). Deploying the latest code applies them when a new revision starts.

## Troubleshooting

### Service Won't Start

1. Check logs: `gcloud run services logs read pantry-api --region us-central1`
2. Verify environment variables are set correctly
3. Check database connectivity if using Cloud SQL
4. Verify the PORT environment variable is being read

### Cold Start Issues

- Reduce container startup time
- Use `--min-instances 1` to keep a warm instance
- Optimize Docker image size
- Use Cloud Run's generation 2 execution environment

### Connection Timeouts

- Increase timeout: `--timeout 300` (5 minutes, max)
- Check database connection pool settings
- Verify Cloud SQL connection configuration

### High Costs

- Use `--min-instances 0` to scale to zero
- Optimize resource allocation (memory/CPU)
- Use Cloud Run's free tier (2 million requests/month)

## Cost Estimation

Cloud Run pricing is based on:
- **CPU/Memory**: $0.00002400 per vCPU-second, $0.00000250 per GiB-second
- **Requests**: $0.40 per million requests
- **Free tier**: 2 million requests/month, 360,000 GiB-seconds, 180,000 vCPU-seconds

Example monthly cost for moderate usage:
- 1 million requests: $0.40
- 360 GiB-hours memory (0.5GB, 720 hours): ~$0.32
- 180 vCPU-hours: ~$1.55
- **Total: ~$2.27/month**

## Next Steps

1. Set up monitoring and alerts
2. Configure custom domain (optional)
3. Set up CI/CD pipeline
4. Optimize container image for faster cold starts
5. Review and optimize resource allocation

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Run Pricing](https://cloud.google.com/run/pricing)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
