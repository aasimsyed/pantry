#!/usr/bin/env python3
"""
Start script for Railway deployment.
Reads PORT from environment and starts uvicorn server.
Automatically initializes database schema on startup.
"""
import os
import sys

if __name__ == "__main__":
    # Initialize database schema (creates tables if they don't exist)
    import sys
    print("🔧 Initializing database schema...", file=sys.stderr, flush=True)
    try:
        from src.database import init_database, get_database_url
        db_url = get_database_url()
        print(f"📊 Database URL: {db_url}", file=sys.stderr, flush=True)
        init_database()
        print("✅ Database schema initialized successfully", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"❌ Database initialization error: {e}", file=sys.stderr, flush=True)
        import traceback
        traceback.print_exc(file=sys.stderr)
        # Continue anyway - tables might already exist
        print("⚠️  Continuing startup despite database warning...", file=sys.stderr, flush=True)
    
    # Get PORT from environment (Railway sets this automatically)
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host=host,
        port=port,
        log_level=os.environ.get("LOG_LEVEL", "info").lower()
    )

