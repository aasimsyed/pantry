# Google Cloud Vision Setup on Railway

## Overview

Google Cloud Vision requires credentials to authenticate. On Railway, we need to set the credentials JSON content as an environment variable (not a file path).

## Step 1: Get Your Google Cloud Credentials

If you don't have credentials yet:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select existing)
3. Enable **Cloud Vision API**:
   - Go to **APIs & Services** → **Library**
   - Search for "Cloud Vision API"
   - Click **Enable**
4. Create a service account:
   - Go to **IAM & Admin** → **Service Accounts**
   - Click **Create Service Account**
   - Give it a name (e.g., "pantry-vision")
   - Grant role: **Cloud Vision API User**
5. Create and download JSON key:
   - Click on the service account
   - Go to **Keys** tab
   - Click **Add Key** → **Create new key** → **JSON**
   - Save the file (e.g., `google-credentials.json`)

## Step 2: Set Up Locally

Add to your `.env` file:
```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-credentials.json
```

## Step 3: Set Up on Railway

### Option A: Automated Script (Easiest)

```bash
# Make sure you're logged in
railway login

# Run the script
./set_google_vision_railway.sh
```

This script will:
- ✅ Read the credentials file path from `.env`
- ✅ Read the JSON content
- ✅ Set it on Railway as an environment variable
- ✅ Validate the JSON format

### Option B: Manual via Railway CLI

```bash
# Read the JSON and set it (using jq to compact)
railway variables --set "GOOGLE_APPLICATION_CREDENTIALS=$(jq -c . /path/to/google-credentials.json)"
```

Or without jq:
```bash
# Read and compact manually
JSON_CONTENT=$(cat /path/to/google-credentials.json | tr -d '\n' | tr -d ' ')
railway variables --set "GOOGLE_APPLICATION_CREDENTIALS=$JSON_CONTENT"
```

### Option C: Railway Dashboard

1. Go to [Railway Dashboard](https://railway.app)
2. Select your project → **Your Service** (not the database)
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Name: `GOOGLE_APPLICATION_CREDENTIALS`
6. Value: Paste the **entire JSON content** (all on one line or with newlines, both work)
7. Click **Add**

## How It Works

### Local Development
- Uses file path: `GOOGLE_APPLICATION_CREDENTIALS=/path/to/file.json`
- Google Cloud SDK reads from file

### Railway Production
- Uses JSON content: `GOOGLE_APPLICATION_CREDENTIALS={"type":"service_account",...}`
- Application reads from environment variable
- The code handles both file path and JSON content

## Verify It's Working

After Railway redeploys, check the logs:

```bash
railway logs
```

Look for:
```
✅ Google Vision OCR backend initialized
Available OCR backends: google, tesseract
```

## Test

Try processing an image from the mobile app. Google Vision should be used (better accuracy than Tesseract).

## Troubleshooting

### Error: "Could not load the default credentials"

- Make sure the JSON content is set correctly on Railway
- Check that the service account has the **Cloud Vision API User** role
- Verify the JSON is valid: `jq . your-credentials.json`

### Error: "Permission denied"

- Check that **Cloud Vision API** is enabled in your Google Cloud project
- Verify the service account has the correct permissions

### Still using Tesseract?

Check the `OCR_PREFERRED_BACKEND` variable:
```bash
railway variables --set OCR_PREFERRED_BACKEND=google
```

## Cost

Google Cloud Vision has a **free tier**:
- First 1,000 requests/month: **FREE**
- After that: $1.50 per 1,000 requests

This is very affordable for personal use!

## Security Notes

- ✅ The credentials JSON is stored securely on Railway
- ✅ Never commit credentials to Git
- ✅ The `.env` file is in `.gitignore`
- ✅ Railway encrypts environment variables

