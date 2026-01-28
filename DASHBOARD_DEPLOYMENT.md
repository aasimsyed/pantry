# Streamlit Dashboard Deployment Guide

This guide explains how to deploy the Smart Pantry Streamlit dashboard to production.

## Deployment Options

### Option 1: Google Cloud Run (Recommended)

Deploy the dashboard as a containerized service on Cloud Run, similar to your API.

**Pros:**
- Consistent infrastructure with your API
- Auto-scaling and pay-per-use
- Easy to manage alongside your API
- Free tier available

**Cons:**
- Requires Docker setup
- Slightly more complex than Streamlit Cloud

#### Quick Deploy

```bash
# Set your project and region
export GCP_PROJECT_ID="pantry-manager-416004"
export GCP_REGION="us-south1"

# Deploy
./deploy-dashboard-cloud-run.sh
```

#### Manual Deploy

```bash
# Build and push image
gcloud builds submit --tag gcr.io/${GCP_PROJECT_ID}/pantry-dashboard

# Deploy to Cloud Run
gcloud run deploy pantry-dashboard \
    --image gcr.io/${GCP_PROJECT_ID}/pantry-dashboard \
    --platform managed \
    --region us-south1 \
    --allow-unauthenticated \
    --port 8501 \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --set-env-vars API_BASE_URL="https://pantry-api-154407938924.us-south1.run.app"
```

### Option 2: Streamlit Cloud (Easiest)

Streamlit's own hosting platform - simplest option.

**Pros:**
- Free tier available
- Very easy setup
- Automatic deployments from GitHub
- Built-in authentication options

**Cons:**
- Separate from your Cloud Run infrastructure
- Less control over configuration

#### Setup Steps

1. **Push your code to GitHub** (if not already)
2. **Sign up at [streamlit.io/cloud](https://streamlit.io/cloud)**
3. **Connect your GitHub repository**
4. **Configure deployment:**
   - **Main file path:** `dashboard/app.py`
   - **Python version:** 3.11
   - **Secrets** (add these in Streamlit Cloud dashboard):
     - `API_BASE_URL`: `https://pantry-api-154407938924.us-south1.run.app`
5. **Deploy!**

Streamlit Cloud will automatically:
- Build and deploy your dashboard
- Provide a public URL (e.g., `https://your-app.streamlit.app`)
- Handle SSL certificates
- Auto-deploy on git push

### Option 3: Self-Hosted (VM/Server)

Run Streamlit on your own server or VM.

**Pros:**
- Full control
- Can use existing infrastructure

**Cons:**
- Requires server management
- Need to handle SSL, updates, monitoring

#### Setup on a VM

```bash
# Install dependencies
sudo apt-get update
sudo apt-get install python3.11 python3-pip

# Clone repository
git clone https://github.com/your-username/pantry.git
cd pantry

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r dashboard/requirements.txt

# Set environment variable
export API_BASE_URL="https://pantry-api-154407938924.us-south1.run.app"

# Run with systemd service or screen/tmux
streamlit run dashboard/app.py --server.port=8501 --server.address=0.0.0.0
```

## Configuration

### Environment Variables

The dashboard needs to know where your production API is:

```bash
# For Cloud Run
gcloud run services update pantry-dashboard \
    --region us-south1 \
    --set-env-vars API_BASE_URL="https://pantry-api-154407938924.us-south1.run.app"

# For local testing
export API_BASE_URL="https://pantry-api-154407938924.us-south1.run.app"
streamlit run dashboard/app.py
```

### Authentication

The dashboard requires users to log in with their API credentials. Users will:
1. Navigate to the dashboard URL
2. See the login page
3. Enter their email and password (same as mobile app)
4. Get authenticated and access all features

## Cost Estimation

### Cloud Run
- **Free tier:** 2 million requests/month, 360,000 GiB-seconds
- **Pricing:** ~$0.40 per million requests, $0.00000250 per GiB-second
- **Estimated cost:** $2-5/month for moderate usage

### Streamlit Cloud
- **Free tier:** Unlimited apps, public sharing
- **Team tier:** $20/month (for private apps, team features)

## Security Considerations

1. **Authentication Required:** All dashboard pages require login
2. **HTTPS:** Cloud Run and Streamlit Cloud provide HTTPS automatically
3. **API Security:** Dashboard uses JWT tokens (same as mobile app)
4. **CORS:** Ensure your API allows requests from dashboard domain

## Monitoring

### Cloud Run Logs

```bash
# View logs
gcloud run services logs tail pantry-dashboard --region us-south1

# Or use the script
./scripts/view-prod-logs.sh tail
```

### Streamlit Cloud

- Logs available in Streamlit Cloud dashboard
- Automatic error reporting

## Troubleshooting

### Dashboard Can't Connect to API

1. **Check API_BASE_URL:** Ensure it's set correctly
2. **Check API is running:** Verify your API is accessible
3. **Check CORS:** Ensure API allows requests from dashboard domain

### Authentication Issues

1. **Check API credentials:** Use same email/password as mobile app
2. **Check token expiration:** Tokens expire after 15 minutes (refresh handled automatically)
3. **Check API health:** Verify `/health` endpoint works

### Performance Issues

1. **Increase memory:** `--memory 1Gi` for Cloud Run
2. **Increase CPU:** `--cpu 2` for Cloud Run
3. **Enable min instances:** `--min-instances 1` to avoid cold starts

## Next Steps

1. Choose your deployment option
2. Deploy the dashboard
3. Test authentication and API connectivity
4. Share the URL with your team
5. Set up monitoring and alerts
