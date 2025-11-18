# Free Backend Deployment Guide (Excluding Render)

This guide covers **completely free** options to deploy your FastAPI backend, excluding Render.

## 🆓 Free Deployment Options

### Option 1: Railway (Recommended - Easiest)

**Railway** offers a generous free tier:
- ✅ **$5 free credit per month** (usually enough for small apps)
- ✅ **Automatic deployments from GitHub**
- ✅ **PostgreSQL database included**
- ✅ **Environment variables management**
- ✅ **Custom domains**
- ✅ **No credit card required** (for free tier)

#### Setup Steps:

1. **Sign up at Railway:**
   - Go to https://railway.app
   - Sign up with GitHub (free)

2. **Create a new project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure the service:**
   - Railway will auto-detect Python
   - Add a start command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
   - Railway automatically sets `$PORT` environment variable

4. **Add PostgreSQL database:**
   
   **Option A: From the project dashboard:**
   - In your Railway project, look for a "+ New" button (usually at the top or bottom of the service list)
   - Click "+ New" or "Add Service"
   - Select "Database" from the dropdown
   - Choose "Add PostgreSQL"
   
   **Option B: From the service menu:**
   - Click on your project name in the left sidebar
   - Click the "+" button or "New" button
   - Select "Database" → "PostgreSQL"
   
   **Option C: Using the command palette:**
   - Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux) to open the command palette
   - Type "PostgreSQL" and select "Add PostgreSQL Database"
   
   Once added, Railway automatically:
   - Creates the PostgreSQL database
   - Sets the `DATABASE_URL` environment variable
   - Links it to your service

5. **Set environment variables:**
   - Go to Variables tab
   - Add your API keys:
     ```
     OPENAI_API_KEY=your-key
     ANTHROPIC_API_KEY=your-key
     GOOGLE_APPLICATION_CREDENTIALS_JSON=your-json
     AI_PROVIDER=openai
     AI_MODEL=gpt-4-turbo-preview
     ```

6. **Deploy:**
   - Railway auto-deploys on git push
   
7. **Get your Railway URL:**
   
   **Option A: From the service settings:**
   - Click on your service name in the Railway dashboard
   - Go to the **"Settings"** tab
   - Scroll down to **"Networking"** or **"Domains"** section
   - You'll see your Railway-generated domain (e.g., `your-app-production.up.railway.app`)
   - Click **"Generate Domain"** if you don't see one
   
   **Option B: From the service overview:**
   - Click on your service
   - Look at the top of the service page
   - You should see a URL or "Open" button next to your service name
   - The URL format is usually: `https://[service-name]-[random].up.railway.app`
   
   **Option C: From the deployments tab:**
   - Click on your service
   - Go to **"Deployments"** tab
   - Click on the latest deployment
   - The URL should be visible in the deployment details
   
   **Option D: Check environment variables:**
   - Go to **"Variables"** tab in your service
   - Railway may have set a `RAILWAY_PUBLIC_DOMAIN` variable
   
   **To get a custom domain:**
   - In Settings → Networking/Domains
   - Click **"Custom Domain"** or **"Add Domain"**
   - Enter your domain name
   - Follow the DNS configuration instructions

**Cost**: Free (with $5 monthly credit)

---

### Option 2: Fly.io (Great for Global Distribution)

**Fly.io** offers a free tier:
- ✅ **3 shared-cpu VMs free**
- ✅ **3GB persistent volume storage**
- ✅ **160GB outbound data transfer**
- ✅ **PostgreSQL database** (separate free tier)
- ✅ **Global edge network**

#### Setup Steps:

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Sign up:**
   ```bash
   fly auth signup
   ```

3. **Create a `fly.toml` file:**
   ```bash
   fly launch
   ```
   This will create a `fly.toml` configuration file.

4. **Update `fly.toml`:**
   ```toml
   app = "your-app-name"
   primary_region = "iad"  # Choose closest region
   
   [build]
   
   [http_service]
     internal_port = 8000
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 0
     processes = ["app"]
   
   [[vm]]
     cpu_kind = "shared"
     cpus = 1
     memory_mb = 256
   ```

5. **Create PostgreSQL database:**
   ```bash
   fly postgres create --name pantry-db
   fly postgres attach pantry-db
   ```

6. **Set secrets:**
   ```bash
   fly secrets set OPENAI_API_KEY=your-key
   fly secrets set ANTHROPIC_API_KEY=your-key
   fly secrets set AI_PROVIDER=openai
   ```

7. **Deploy:**
   ```bash
   fly deploy
   ```

**Cost**: Free (with generous limits)

---

### Option 3: Google Cloud Run (Serverless)

**Google Cloud Run** has a free tier:
- ✅ **2 million requests/month free**
- ✅ **360,000 GB-seconds compute free**
- ✅ **Pay only for what you use**
- ✅ **Automatic scaling to zero**

#### Setup Steps:

1. **Install Google Cloud SDK:**
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

2. **Create a project:**
   ```bash
   gcloud init
   gcloud projects create pantry-backend
   gcloud config set project pantry-backend
   ```

3. **Create `Dockerfile`:**
   ```dockerfile
   FROM python:3.11-slim
   
   WORKDIR /app
   
   # Install system dependencies
   RUN apt-get update && apt-get install -y \
       tesseract-ocr \
       libtesseract-dev \
       libopencv-dev \
       && rm -rf /var/lib/apt/lists/*
   
   # Copy requirements
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   
   # Copy application
   COPY . .
   
   # Run the application
   CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
   ```

4. **Build and deploy:**
   ```bash
   # Build container
   gcloud builds submit --tag gcr.io/pantry-backend/api
   
   # Deploy to Cloud Run
   gcloud run deploy pantry-api \
     --image gcr.io/pantry-backend/api \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars "OPENAI_API_KEY=your-key,AI_PROVIDER=openai"
   ```

5. **Add PostgreSQL:**
   - Use Cloud SQL (has free tier) or external PostgreSQL

**Cost**: Free tier covers most small apps

---

### Option 4: PythonAnywhere (Simple but Limited)

**PythonAnywhere** has a free tier:
- ✅ **Free web app hosting**
- ✅ **512MB disk space**
- ✅ **MySQL database included**
- ⚠️ **Limited to 1 web app**
- ⚠️ **No custom domains on free tier**

#### Setup Steps:

1. **Sign up at PythonAnywhere:**
   - Go to https://www.pythonanywhere.com
   - Create free account

2. **Upload your code:**
   - Use Files tab to upload your project
   - Or clone from GitHub

3. **Install dependencies:**
   - Open Bash console
   - Run: `pip3.10 install --user -r requirements.txt`

4. **Create web app:**
   - Go to Web tab
   - Click "Add a new web app"
   - Choose Flask (we'll configure it for FastAPI)
   - Set source code path

5. **Configure WSGI:**
   - Edit WSGI file to use FastAPI:
   ```python
   import sys
   path = '/home/yourusername/pantry'
   if path not in sys.path:
       sys.path.append(path)
   
   from api.main import app
   application = app
   ```

6. **Set environment variables:**
   - In Web tab → Environment variables

**Cost**: Free (with limitations)

---

### Option 5: Replit (Quick Prototyping)

**Replit** has a free tier:
- ✅ **Free hosting**
- ✅ **Automatic deployments**
- ✅ **Built-in database options**
- ⚠️ **Apps sleep after inactivity**

#### Setup Steps:

1. **Sign up at Replit:**
   - Go to https://replit.com
   - Create account

2. **Import from GitHub:**
   - Create new Repl
   - Import from GitHub

3. **Configure:**
   - Add `.replit` file:
   ```toml
   run = "uvicorn api.main:app --host 0.0.0.0 --port 8000"
   ```

4. **Set secrets:**
   - Use Secrets tab for API keys

5. **Deploy:**
   - Click "Deploy" button
   - Get your URL

**Cost**: Free (with sleep limitations)

---

### Option 6: Self-Hosting (100% Free, Requires Server)

If you have a server (Raspberry Pi, old computer, VPS):

#### Using Docker:

1. **Create `Dockerfile`:**
   ```dockerfile
   FROM python:3.11-slim
   
   WORKDIR /app
   
   RUN apt-get update && apt-get install -y \
       tesseract-ocr \
       libtesseract-dev \
       && rm -rf /var/lib/apt/lists/*
   
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   
   COPY . .
   
   CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
   ```

2. **Create `docker-compose.yml`:**
   ```yaml
   version: '3.8'
   
   services:
     api:
       build: .
       ports:
         - "8000:8000"
       environment:
         - DATABASE_URL=postgresql://user:pass@db:5432/pantry
         - OPENAI_API_KEY=${OPENAI_API_KEY}
       depends_on:
         - db
     
     db:
       image: postgres:15
       environment:
         - POSTGRES_USER=user
         - POSTGRES_PASSWORD=pass
         - POSTGRES_DB=pantry
       volumes:
         - postgres_data:/var/lib/postgresql/data
   
   volumes:
     postgres_data:
   ```

3. **Deploy:**
   ```bash
   docker-compose up -d
   ```

---

## 📋 Pre-Deployment Checklist

### 1. Update Database Configuration

For production, use PostgreSQL. Update your environment variables:

```bash
DATABASE_URL=postgresql://user:password@host:5432/pantry
# OR
DB_TYPE=postgresql
DB_HOST=your-db-host
DB_NAME=pantry
DB_USER=your-user
DB_PASSWORD=your-password
```

### 2. Update CORS Settings

In `api/config.py`, update `cors_origins`:
```python
cors_origins = [
    "http://localhost:5173",  # React dev
    "https://your-mobile-app.com",  # Production mobile app
    "exp://your-expo-app",  # Expo app
]
```

### 3. Set Production Environment Variables

Required variables:
```bash
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key  # Optional
AI_PROVIDER=openai
AI_MODEL=gpt-4-turbo-preview
DATABASE_URL=postgresql://...
LOG_LEVEL=INFO
```

### 4. Update API URL in Mobile App

In `mobile/src/api/client.ts`:
```typescript
return process.env.EXPO_PUBLIC_API_URL || 'https://your-backend.railway.app';
```

### 5. Handle File Storage

For production, consider:
- **Cloud storage**: AWS S3, Google Cloud Storage (free tiers)
- **Local storage**: Works for small deployments
- **Database**: Store images as base64 (not recommended for large files)

---

## 🚀 Quick Start: Railway (Recommended)

1. **Sign up**: https://railway.app (GitHub login)

2. **Deploy from GitHub:**
   - Click "New Project" → "Deploy from GitHub"
   - Select your repo

3. **Add PostgreSQL:**
   - Click "New" → "Database" → "Add PostgreSQL"

4. **Set environment variables:**
   - Variables tab → Add your API keys

5. **Update start command:**
   - Settings → Start Command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`

6. **Deploy:**
   - Railway auto-deploys on git push
   - Get URL from Settings → Domains

**Time to deploy**: ~5 minutes

---

## 📊 Comparison Table

| Platform | Free Tier | Ease | PostgreSQL | Auto-Deploy | Best For |
|----------|-----------|------|------------|-------------|----------|
| **Railway** | $5/month credit | ⭐⭐⭐⭐⭐ | ✅ | ✅ | Easiest setup |
| **Fly.io** | 3 VMs free | ⭐⭐⭐⭐ | ✅ | ✅ | Global distribution |
| **Cloud Run** | 2M requests | ⭐⭐⭐ | ⚠️ | ⚠️ | Serverless |
| **PythonAnywhere** | 1 app | ⭐⭐⭐ | MySQL only | ❌ | Simple apps |
| **Replit** | Free | ⭐⭐⭐⭐ | ⚠️ | ✅ | Quick prototyping |
| **Self-Host** | 100% free | ⭐⭐ | ✅ | ❌ | Full control |

---

## ⚠️ Important Notes

1. **Database**: Most platforms provide PostgreSQL. SQLite works for development but not recommended for production.

2. **File Storage**: For image processing, you may need persistent storage. Most platforms provide this.

3. **Tesseract OCR**: Some platforms may not have Tesseract pre-installed. You may need to:
   - Use Docker (includes system dependencies)
   - Or use Google Cloud Vision only (no Tesseract needed)

4. **Cold Starts**: Serverless platforms (Cloud Run) may have cold starts. Railway and Fly.io keep apps warm.

5. **Rate Limits**: Free tiers have rate limits. Monitor usage in platform dashboards.

---

## 🔧 Troubleshooting

### Build Fails
- Check platform-specific requirements
- Ensure all dependencies are in `requirements.txt`
- Check build logs for specific errors

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check database is accessible from your app
- Ensure PostgreSQL extensions are enabled

### API Not Accessible
- Check CORS settings
- Verify port configuration
- Check firewall/security settings

### Image Processing Fails
- Ensure Tesseract is installed (or use Docker)
- Check file permissions
- Verify OpenCV dependencies

---

## 📚 Resources

- [Railway Docs](https://docs.railway.app)
- [Fly.io Docs](https://fly.io/docs)
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)
- [PythonAnywhere Docs](https://help.pythonanywhere.com)
- [Replit Docs](https://docs.replit.com)

---

## 🎯 Recommended Path

1. **Start with Railway** (easiest, most reliable)
2. **If you need global distribution**: Use Fly.io
3. **If you want serverless**: Use Google Cloud Run
4. **For full control**: Self-host with Docker

All options are **100% free** (within their free tier limits)!

