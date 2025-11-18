# Fix: Variables Not Loading on Railway

## Problem

The logs show:
- `OpenAI API key not configured`
- `Anthropic API key not configured`
- `Available OCR backends: tesseract` (Google Vision not available)

This means the environment variables are set but not being loaded by the web service.

## Solution

The variables might be set on the wrong service. Railway has separate services:
- **Postgres** (database service)
- **Web** (your FastAPI application)

Variables need to be set on the **Web** service, not the database service.

## Fix Steps

### Option 1: Set Variables on Web Service via CLI

```bash
# Make sure you're linked to the project
railway link

# Set variables on the web service
railway variables --service web --set "OPENAI_API_KEY=your-key"
railway variables --service web --set "AI_PROVIDER=openai"
railway variables --service web --set "AI_MODEL=gpt-4-turbo-preview"
railway variables --service web --set "ANTHROPIC_API_KEY=your-key"
railway variables --service web --set "GOOGLE_APPLICATION_CREDENTIALS=your-json"
```

### Option 2: Use Railway Dashboard

1. Go to [Railway Dashboard](https://railway.app)
2. Select your project
3. Click on the **Web** service (not Postgres)
4. Go to **Variables** tab
5. Make sure these variables are set:
   - `OPENAI_API_KEY`
   - `AI_PROVIDER`
   - `AI_MODEL`
   - `ANTHROPIC_API_KEY`
   - `GOOGLE_APPLICATION_CREDENTIALS`

### Option 3: Use the Script (Updated)

The script needs to target the web service. Update it:

```bash
# In set_railway_ai_keys.sh, add --service web flag
railway variables --service web --set "OPENAI_API_KEY=$OPENAI_KEY"
```

## Verify

After setting variables on the web service:

1. Railway will auto-redeploy
2. Check logs: `railway logs --service web`
3. Look for:
   - `✅ OpenAI backend available`
   - `✅ Google Vision OCR backend initialized`
   - `Available OCR backends: google, tesseract`

## Quick Fix Command

```bash
# Get values from .env
OPENAI_KEY=$(grep "^OPENAI_API_KEY=" .env | cut -d'=' -f2-)
AI_PROVIDER=$(grep "^AI_PROVIDER=" .env | cut -d'=' -f2-)
AI_MODEL=$(grep "^AI_MODEL=" .env | cut -d'=' -f2-)

# Set on web service
railway variables --service web --set "OPENAI_API_KEY=$OPENAI_KEY"
railway variables --service web --set "AI_PROVIDER=$AI_PROVIDER"
railway variables --service web --set "AI_MODEL=$AI_MODEL"
```

