# Link PostgreSQL to Your Railway Service

## Issue

PostgreSQL database exists, but `DATABASE_URL` is not available to your service. Railway needs to **link** the database to your service.

## Solution: Link Database to Service

### Option 1: Via Railway Dashboard (Easiest)

1. **Go to Railway Dashboard:**
   - https://railway.app
   - Select your project: `heartfelt-endurance`

2. **Find Your PostgreSQL Database:**
   - Look in the services list for a PostgreSQL service
   - It might be named "Postgres" or "postgres" or similar

3. **Link Database to Service:**
   - Click on your **web service**
   - Go to **Settings** tab
   - Scroll to **"Connected Services"** or **"Service Dependencies"**
   - Click **"Connect"** or **"Link"** next to your PostgreSQL database
   - OR: In PostgreSQL service → **Settings** → **"Connected Services"** → Link to web service

4. **Verify:**
   - Go to web service → **Variables** tab
   - You should now see `DATABASE_URL` (it's automatically set when linked)

### Option 2: Via Railway CLI

```bash
# List all services
railway service list

# Link database to service (if CLI supports it)
# Note: This might need to be done via dashboard
```

### Option 3: Manual Connection String

If linking doesn't work, you can manually set `DATABASE_URL`:

1. **Get PostgreSQL Connection String:**
   - Go to PostgreSQL service in Railway
   - Click **"Variables"** tab
   - Look for connection details or click **"Connect"** button
   - Copy the connection string (format: `postgresql://user:password@host:port/dbname`)

2. **Set in Web Service:**
   ```bash
   railway variables --set "DATABASE_URL=postgresql://user:pass@host:port/dbname"
   ```

## Verify It's Working

After linking, verify:

```bash
# Check if DATABASE_URL is set
railway variables | grep DATABASE_URL

# Test database connection
railway run python -c "from src.database import get_database_url; print(get_database_url())"
```

You should see a `postgresql://` URL, not `sqlite://`.

## Run Migration

Once `DATABASE_URL` is set:

```bash
railway run python -c "from src.database import init_database; init_database()"
```

## Test Authentication

```bash
./test_railway_auth.sh
```

## Common Issues

### "DATABASE_URL not found"
- Database might not be linked to service
- Check Railway dashboard → Service → Connected Services

### "Connection refused"
- Database might not be running
- Check Railway dashboard → PostgreSQL service status

### "Authentication failed"
- Check PostgreSQL credentials in Railway
- Verify connection string format

