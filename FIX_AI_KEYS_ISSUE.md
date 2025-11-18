# Fix: AI API Keys Not Loading

## Problem

The `/api/inventory/process-image` endpoint is failing with a 500 error because:
- **AI analyzer cannot initialize** - No API keys found
- Error: "No AI backends available. Check API keys."

## Root Cause

The backend server might not be loading the `.env` file, or the API keys are not set.

## Solution

### Option 1: Check .env File

Make sure your `.env` file has the API keys:

```bash
# In /Users/aasim/src/pantry/.env
OPENAI_API_KEY=your-actual-openai-key-here
ANTHROPIC_API_KEY=your-actual-anthropic-key-here
AI_PROVIDER=openai
AI_MODEL=gpt-4-turbo-preview
```

### Option 2: Restart Backend Server

The backend should load `.env` automatically, but restart it to be sure:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd /Users/aasim/src/pantry
python start_server.py
```

### Option 3: Set Environment Variables Directly

If `.env` isn't working, set them in your shell:

```bash
export OPENAI_API_KEY=your-key-here
export AI_PROVIDER=openai
export AI_MODEL=gpt-4-turbo-preview

# Then restart server
python start_server.py
```

### Option 4: Use Production Backend (Recommended)

The Railway backend already has the API keys configured. Use it instead:

```bash
cd mobile
export EXPO_PUBLIC_API_URL=https://pantry.up.railway.app
npm start
```

## Test

After fixing, test the services:

```bash
python3 -c "
from src.ocr_service import create_ocr_service
from src.ai_analyzer import create_ai_analyzer
ocr = create_ocr_service()
print('✅ OCR service OK')
ai = create_ai_analyzer()
print('✅ AI analyzer OK')
"
```

Both should print ✅ if configured correctly.

## Quick Fix

1. **Check `.env` file exists and has keys**
2. **Restart backend server**
3. **Reload mobile app**

The improved error handling will now show exactly which service is failing.

