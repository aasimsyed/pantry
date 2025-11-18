# Railway Environment Variables Guide

## Should You Set All Variables?

**Short answer: No, only set the ones needed for production.**

## Required Variables (Must Set)

These are essential for the application to work:

### 1. Security & Authentication
- `SECRET_KEY` - Secret key for JWT signing (already set)
- `JWT_ALGORITHM` - JWT algorithm (default: HS256, already set)
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` - Access token expiry (already set)
- `JWT_REFRESH_TOKEN_EXPIRE_DAYS` - Refresh token expiry (already set)

### 2. AI Configuration (Just Set ✅)
- `OPENAI_API_KEY` - Your OpenAI API key ✅
- `AI_PROVIDER` - Provider: `openai` or `anthropic` ✅
- `AI_MODEL` - Model name: `gpt-4-turbo-preview` ✅
- `ANTHROPIC_API_KEY` - Anthropic API key (optional, for fallback) ✅

### 3. OCR Configuration (If Using Google Cloud Vision)
- `GOOGLE_APPLICATION_CREDENTIALS` - **Special case** (see below)

## Optional Variables (Nice to Have)

These have sensible defaults but can be customized:

- `AI_TEMPERATURE` - AI temperature (default: 0.0)
- `AI_MAX_TOKENS` - Max tokens (default: 2000)
- `AI_TIMEOUT` - Timeout in seconds (default: 30)
- `AI_MIN_CONFIDENCE` - Min confidence (default: 0.7)
- `OCR_PREFERRED_BACKEND` - `google` or `tesseract` (default: google)
- `OCR_CONFIDENCE_THRESHOLD` - OCR confidence (default: 0.85)

## Special Cases

### GOOGLE_APPLICATION_CREDENTIALS

This is tricky because:
- **Local**: Points to a JSON file path
- **Railway**: Needs the JSON content as an environment variable

**Option 1: Set JSON content directly**
```bash
railway variables --set GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account",...}'
```

**Option 2: Use Railway Dashboard**
1. Go to Railway Dashboard → Your Service → Variables
2. Add `GOOGLE_APPLICATION_CREDENTIALS`
3. Paste the entire JSON content as the value

**Option 3: Skip if using Tesseract only**
- If you only use Tesseract OCR, you don't need this
- Tesseract works without API keys

## Variables NOT to Set

These are handled automatically by Railway:
- `DATABASE_URL` - Set automatically by Railway PostgreSQL
- `PORT` - Set automatically by Railway
- `HOST` - Set automatically by Railway

## Quick Sync Script

Use the automated script to sync all necessary variables:

```bash
./sync_railway_env.sh
```

This will:
- ✅ Read from your `.env` file
- ✅ Set only necessary variables
- ✅ Skip file paths (like GOOGLE_APPLICATION_CREDENTIALS)
- ✅ Show you what needs manual setup

## Manual Setup

If you prefer to set variables manually:

```bash
# Security (already done)
railway variables --set SECRET_KEY="your-secret-key"
railway variables --set JWT_ALGORITHM=HS256

# AI (already done)
railway variables --set OPENAI_API_KEY="your-key"
railway variables --set AI_PROVIDER=openai
railway variables --set AI_MODEL=gpt-4-turbo-preview

# OCR (if needed)
railway variables --set GOOGLE_APPLICATION_CREDENTIALS='{"type":"service_account",...}'
```

## Verify

Check what's set:
```bash
railway variables
```

## Current Status

✅ **Already Set:**
- Security variables (SECRET_KEY, JWT_*)
- AI variables (OPENAI_API_KEY, AI_PROVIDER, AI_MODEL, ANTHROPIC_API_KEY)

⚠️ **May Need:**
- GOOGLE_APPLICATION_CREDENTIALS (if using Google Cloud Vision)

## Recommendation

**For now, you're good!** The essential variables are set. Only add `GOOGLE_APPLICATION_CREDENTIALS` if:
1. You want to use Google Cloud Vision OCR (better accuracy)
2. You have the service account JSON file

Otherwise, Tesseract OCR will work fine without it.

