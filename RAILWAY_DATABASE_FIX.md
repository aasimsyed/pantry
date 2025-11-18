# Railway Database Issue - SQLite Ephemeral Storage

## Problem

Railway uses **ephemeral storage** by default, which means SQLite database files are **lost on each deployment**. This is why the `users` table doesn't exist even though initialization runs.

## Solutions

### Option 1: Use PostgreSQL (Recommended for Production)

Railway provides PostgreSQL databases that persist data:

1. **Add PostgreSQL Database:**
   - Go to Railway → Your Project
   - Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
   - Railway will automatically set `DATABASE_URL`

2. **Update Environment:**
   - Railway automatically sets `DATABASE_URL` when you add PostgreSQL
   - Your app will automatically use it (no code changes needed)

3. **Run Migration:**
   ```bash
   railway run python -c "from src.database import init_database; init_database()"
   ```

### Option 2: Use Railway Volume (For SQLite)

If you want to keep SQLite:

1. **Create Volume:**
   - Railway → Your Project → **"+ New"** → **"Volume"**
   - Name: `pantry-data`
   - Mount path: `/data`

2. **Update Database Path:**
   - Set environment variable: `DB_PATH=/data/pantry.db`
   - Or update `start_server.py` to use volume path

3. **Update Code:**
   ```python
   # In src/database.py or start_server.py
   import os
   DB_PATH = os.getenv("DB_PATH", "./pantry.db")
   ```

### Option 3: Initialize on Every Request (Temporary Fix)

Add database initialization to API startup:

```python
# In api/main.py, add to startup event
@app.on_event("startup")
async def startup_event():
    from src.database import init_database
    init_database()
```

## Recommended: Use PostgreSQL

For production, PostgreSQL is the best choice:
- ✅ Data persists across deployments
- ✅ Better performance
- ✅ Supports concurrent connections
- ✅ Railway provides it for free (with limits)

## Quick Fix: Add PostgreSQL Now

1. Railway Dashboard → Your Project
2. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway auto-sets `DATABASE_URL`
4. Run migration:
   ```bash
   railway run python -c "from src.database import init_database; init_database()"
   ```
5. Test authentication - it should work!

## Current Status

✅ Security variables are set  
✅ Database initialization code is running  
❌ Database file is lost on each deployment (ephemeral storage)  
✅ Solution: Add PostgreSQL database

