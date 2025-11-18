# Railway CLI Setup & Variable Configuration

## Step 1: Login to Railway

First, you need to authenticate with Railway:

```bash
railway login
```

This will open a browser window for you to authenticate. After logging in, you'll be able to use the CLI.

## Step 2: Link to Your Project (if needed)

If you haven't linked your project yet:

```bash
railway link
```

Select your project from the list.

## Step 3: Check Current Variables

```bash
railway variables
```

## Step 4: Set Security Variables

The Railway CLI syntax for setting variables is:

```bash
railway variables --set SECRET_KEY="your-secret-key-here"
railway variables --set JWT_ALGORITHM=HS256
railway variables --set JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
railway variables --set JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
```

Or set multiple at once:

```bash
railway variables \
  --set SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')" \
  --set JWT_ALGORITHM=HS256 \
  --set JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15 \
  --set JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
```

## Alternative: Use Railway Dashboard

If CLI doesn't work, use the web dashboard:

1. Go to https://railway.app
2. Select your project
3. Click on your service
4. Go to **Variables** tab
5. Click **+ New Variable**
6. Add each variable:
   - `SECRET_KEY` = (generate with: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`)
   - `JWT_ALGORITHM` = `HS256`
   - `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` = `15`
   - `JWT_REFRESH_TOKEN_EXPIRE_DAYS` = `30`

## Verify Variables Are Set

After setting, verify:

```bash
railway variables | grep -E "SECRET_KEY|JWT_"
```

## Trigger Redeploy

After setting variables, Railway will auto-redeploy, or trigger manually:

```bash
railway up
```

Or use the dashboard: Deployments → Redeploy

