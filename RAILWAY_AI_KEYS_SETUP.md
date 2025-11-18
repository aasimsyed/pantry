# Set AI API Keys on Railway

## Problem

The Railway backend is missing AI API keys, causing this error:
```
AI analyzer unavailable: No AI backends available. Check API keys.
```

## Solution: Set Environment Variables on Railway

You need to set these environment variables on Railway:

### Required Variables

1. **OPENAI_API_KEY** - Your OpenAI API key
2. **AI_PROVIDER** - Set to `openai` (or `anthropic` if using Claude)
3. **AI_MODEL** - Set to `gpt-4-turbo-preview` (or `claude-3-5-sonnet-20241022` for Claude)

### Optional (if using Claude)

4. **ANTHROPIC_API_KEY** - Your Anthropic API key (only if using Claude)

## Method 1: Using Automated Script (Easiest)

```bash
# Make sure you're logged in
railway login

# Run the script (it reads from your .env file)
./set_railway_ai_keys.sh
```

This script will:
- ✅ Read your API keys from `.env`
- ✅ Set them on Railway automatically
- ✅ Handle all the variables (OPENAI_API_KEY, AI_PROVIDER, AI_MODEL, etc.)

## Method 2: Using Railway CLI (Manual)

```bash
# Make sure you're logged in
railway login

# Link to your project (if not already linked)
railway link

# Set the variables (replace with your actual keys)
railway variables --set "OPENAI_API_KEY=your-actual-openai-key-here"
railway variables --set "AI_PROVIDER=openai"
railway variables --set "AI_MODEL=gpt-4-turbo-preview"

# Optional: If you want to use Claude as fallback
railway variables --set "ANTHROPIC_API_KEY=your-actual-anthropic-key-here"
```

## Method 2: Using Railway Dashboard

1. Go to [Railway Dashboard](https://railway.app)
2. Select your project
3. Click on your **web service** (not the database)
4. Go to **Variables** tab
5. Click **+ New Variable**
6. Add each variable:
   - `OPENAI_API_KEY` = `your-actual-openai-key-here`
   - `AI_PROVIDER` = `openai`
   - `AI_MODEL` = `gpt-4-turbo-preview`
   - (Optional) `ANTHROPIC_API_KEY` = `your-actual-anthropic-key-here`

## Verify

After setting the variables, Railway will automatically redeploy. Check the logs:

```bash
railway logs
```

You should see:
```
✅ AI Analyzer initialized with provider: openai
```

## Test

Try processing an image from the mobile app again. It should work now!

## Get Your API Keys

- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/settings/keys

