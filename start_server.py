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
    try:
        from src.database import init_database
        init_database()
        print("✅ Database schema initialized")
    except Exception as e:
        print(f"⚠️  Database initialization warning: {e}")
        # Continue anyway - tables might already exist
    
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

