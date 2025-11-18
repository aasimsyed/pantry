#!/usr/bin/env python3
"""
Start script for Railway deployment.
Reads PORT from environment and starts uvicorn server.
"""
import os
import sys

if __name__ == "__main__":
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

