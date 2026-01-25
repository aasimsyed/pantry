#!/bin/bash
# Manual Database Fix Script
# This script fixes the orphaned index issue that's preventing table creation
#
# Prerequisites:
#   - gcloud authenticated: gcloud auth application-default login
#   - Cloud SQL Proxy installed (or use gcloud sql connect)

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔧 Manual Database Fix - Drop Orphaned Index${NC}"
echo ""

# Check if gcloud is authenticated (try both ADC and user account)
if ! gcloud auth application-default print-access-token > /dev/null 2>&1; then
    if ! gcloud auth print-access-token > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  No gcloud authentication found${NC}"
        echo ""
        echo "Please run this command first:"
        echo "  gcloud auth application-default login"
        echo ""
        echo "Or ensure you're logged in with:"
        echo "  gcloud auth login"
        exit 1
    else
        echo -e "${GREEN}✅ Using user account credentials${NC}"
        export GOOGLE_APPLICATION_CREDENTIALS=""
    fi
else
    echo -e "${GREEN}✅ Application Default Credentials found${NC}"
fi
echo ""

# Check if psql is available
if command -v psql &> /dev/null; then
    echo "Method 1: Using gcloud sql connect (requires psql)..."
    echo ""
    echo "Run these commands:"
    echo "  gcloud sql connect pantry-db --user=pantry-user --database=pantry"
    echo ""
    echo "Then in the SQL prompt, run:"
    echo "  DROP INDEX IF EXISTS ix_users_email CASCADE;"
    echo "  \\q"
    echo ""
fi

# Option 2: Use Cloud SQL Proxy + Python
echo "Method 2: Using Cloud SQL Proxy + Python (automated)..."
echo ""

# Start Cloud SQL Proxy
echo "Starting Cloud SQL Proxy..."
cloud-sql-proxy pantry-manager-416004:us-south1:pantry-db --port=5433 --address=127.0.0.1 > /tmp/cloud-sql-proxy.log 2>&1 &
PROXY_PID=$!
echo "Proxy PID: $PROXY_PID"
sleep 5

# Check if proxy is running
if ! nc -z 127.0.0.1 5433 2>/dev/null; then
    echo -e "${RED}❌ Cloud SQL Proxy failed to start${NC}"
    tail -20 /tmp/cloud-sql-proxy.log
    kill $PROXY_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✅ Cloud SQL Proxy is running${NC}"
echo ""

# Run Python script to fix database
echo "Connecting to database and dropping orphaned index..."
python3 << 'EOF'
import os
import sys
sys.path.insert(0, os.getcwd())

from sqlalchemy import create_engine, text

db_url = 'postgresql://pantry-user:FyHgKlKTghCKphKDEWpXTWoMVoFcNSFU@127.0.0.1:5433/pantry'
print(f"Connecting to: {db_url[:60]}...")

engine = create_engine(db_url, connect_args={'connect_timeout': 10})

try:
    with engine.begin() as conn:
        print("\nStep 1: Checking if index exists...")
        result = conn.execute(text("""
            SELECT indexname FROM pg_indexes 
            WHERE indexname = 'ix_users_email' 
            AND schemaname = 'public'
        """))
        rows = result.fetchall()
        if rows:
            print(f"   ✅ Found index: {rows[0][0]}")
        else:
            print("   ✅ Index doesn't exist (already fixed!)")
            sys.exit(0)
        
        print("\nStep 2: Dropping orphaned index...")
        conn.execute(text("DROP INDEX IF EXISTS ix_users_email CASCADE"))
        print("   ✅ DROP INDEX executed!")
        
        print("\nStep 3: Verifying index is gone...")
        result = conn.execute(text("""
            SELECT indexname FROM pg_indexes 
            WHERE indexname = 'ix_users_email' 
            AND schemaname = 'public'
        """))
        rows = result.fetchall()
        if rows:
            print(f"   ⚠️  Index still exists: {rows}")
            sys.exit(1)
        else:
            print("   ✅ Index confirmed dropped!")
            
        print("\n🎉 Manual fix complete! Database is ready for table creation.")
        sys.exit(0)
            
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
EOF

EXIT_CODE=$?

# Cleanup
echo ""
echo "Cleaning up..."
kill $PROXY_PID 2>/dev/null || true
wait $PROXY_PID 2>/dev/null || true

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Fix complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Restart Cloud Run service (or wait for next deployment)"
    echo "  2. Tables will be created automatically on startup"
    echo "  3. Test login: curl -X POST https://pantry-api-154407938924.us-south1.run.app/api/auth/login -F 'email=admin@pantry.com' -F 'password=Admin12345'"
else
    echo ""
    echo -e "${RED}❌ Fix failed. Check errors above.${NC}"
fi

exit $EXIT_CODE
