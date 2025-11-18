# Quick Deploy Backend - Railway (5 Minutes)

The fastest way to deploy your FastAPI backend for free.

## Step 1: Sign Up (1 minute)

1. Go to https://railway.app
2. Click "Start a New Project"
3. Sign in with GitHub (free)

## Step 2: Deploy from GitHub (2 minutes)

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your `pantry` repository
4. Railway will auto-detect Python

## Step 3: Add PostgreSQL Database (1 minute)

**How to add PostgreSQL in Railway:**

1. **In your Railway project dashboard**, look for one of these:
   - A **"+ New"** button (usually at the top right or bottom of the services list)
   - A **"New"** button in the project view
   - A **"+"** icon next to your service

2. **Click it and you'll see options like:**
   - "Empty Service"
   - "Database"
   - "GitHub Repo"
   - etc.

3. **Select "Database"** → **"PostgreSQL"**

4. **Railway will automatically:**
   - Create the PostgreSQL database
   - Set the `DATABASE_URL` environment variable
   - Link it to your service

**Alternative:** If you can't find the button, try:
- Looking in the left sidebar for a "+" or "New" option
- Using the command palette: Press `Cmd+K` (Mac) or `Ctrl+K` (Windows) and type "PostgreSQL"
- Checking if there's a "Resources" or "Add Resource" section

## Step 4: Configure Environment Variables (1 minute)

1. Click on your service → "Variables" tab
2. Add these variables:

```
OPENAI_API_KEY=your-openai-key-here
ANTHROPIC_API_KEY=your-anthropic-key-here  # Optional
AI_PROVIDER=openai
AI_MODEL=gpt-4-turbo-preview
LOG_LEVEL=INFO
```

**Note**: `DATABASE_URL` is automatically set by Railway when you add PostgreSQL.

## Step 5: Set Start Command (30 seconds)

1. Click on your service → "Settings"
2. Under "Start Command", set:
   ```
   uvicorn api.main:app --host 0.0.0.0 --port $PORT
   ```

## Step 6: Deploy (Automatic)

Railway automatically deploys when you:
- Push to GitHub
- Or click "Deploy" in the dashboard

## Step 7: Get Your URL

1. Click on your service → "Settings"
2. Under "Domains", you'll see your URL:
   - Example: `https://your-app.railway.app`

## Step 8: Update Mobile App

In `mobile/src/api/client.ts`, update:
```typescript
return process.env.EXPO_PUBLIC_API_URL || 'https://your-app.railway.app';
```

## That's It! 🎉

Your backend is now live and free (within Railway's $5/month credit).

## Troubleshooting

### Build Fails
- Check that `requirements.txt` is in the root directory
- Verify Python version (Railway uses Python 3.11 by default)

### Database Connection Error
- Verify PostgreSQL service is running
- Check that `DATABASE_URL` is set (Railway sets this automatically)

### API Not Accessible
- Check that the service is running (green status)
- Verify the URL is correct
- Check CORS settings in `api/config.py`

## Next Steps

- **Custom Domain**: Add your own domain in Railway settings
- **Monitoring**: Railway provides logs and metrics
- **Scaling**: Upgrade if you exceed free tier (unlikely for small apps)

## Cost

- **Free**: $5 credit per month (usually enough for small apps)
- **Paid**: Only if you exceed free tier

---

**Total Time**: ~5 minutes  
**Cost**: Free (within limits)  
**Difficulty**: ⭐ Easy

