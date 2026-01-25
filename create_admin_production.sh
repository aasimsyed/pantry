#!/bin/bash
# Create Admin Account in Production (Cloud SQL) Database
# This script creates an admin account in the Cloud Run production database
#
# Prerequisites:
#   - Cloud SQL Proxy installed and running, OR
#   - DATABASE_URL environment variable set to connect via Cloud SQL Proxy
#
# Usage:
#   # With Cloud SQL Proxy running on localhost:5432
#   export DATABASE_URL='postgresql://pantry-user:password@localhost:5432/pantry'
#   ./create_admin_production.sh
#
#   # Or with direct credentials
#   ./create_admin_production.sh --email admin@pantry.com --password Admin12345

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔐 Create Admin Account in Production Database (Cloud SQL)${NC}"
echo ""

# Default values
EMAIL="${EMAIL:-admin@pantry.com}"
PASSWORD="${PASSWORD:-Admin12345}"
NAME="${NAME:-Admin User}"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --password)
            PASSWORD="$2"
            shift 2
            ;;
        --name)
            NAME="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Email: $EMAIL"
echo "  Name: $NAME"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set${NC}"
    echo ""
    echo "To connect to Cloud SQL, you need to set DATABASE_URL."
    echo ""
    echo "Option 1: Use Cloud SQL Proxy (recommended)"
    echo "  1. Install Cloud SQL Proxy:"
    echo "     brew install cloud-sql-proxy  # macOS"
    echo "     # Or download from: https://cloud.google.com/sql/docs/postgres/connect-admin-proxy"
    echo ""
    echo "  2. Start the proxy:"
    echo "     cloud-sql-proxy pantry-manager-416004:us-south1:pantry-db"
    echo ""
    echo "  3. In another terminal, set DATABASE_URL:"
    echo "     export DATABASE_URL='postgresql://pantry-user:FyHgKlKTghCKphKDEWpXTWoMVoFcNSFU@localhost:5432/pantry'"
    echo ""
    echo "  4. Run this script again"
    echo ""
    echo "Option 2: Use gcloud sql connect (interactive)"
    echo "  gcloud sql connect pantry-db --user=pantry-user --database=pantry"
    echo "  # Then manually run SQL to create the admin account"
    echo ""
    echo "Option 3: Use Cloud Run exec (if enabled)"
    echo "  gcloud run services exec pantry-api --region us-south1 --command python3 -- create_admin.py"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL is set${NC}"
echo ""

# Verify we can connect to PostgreSQL (not SQLite)
if [[ "$DATABASE_URL" == sqlite* ]]; then
    echo -e "${RED}❌ DATABASE_URL points to SQLite, not PostgreSQL${NC}"
    echo "This script is for creating admin accounts in the production Cloud SQL database."
    echo "For local development, use: python3 create_admin.py"
    exit 1
fi

echo -e "${BLUE}Creating admin account in production database...${NC}"
echo ""

# Set DATABASE_URL for the Python script
export DATABASE_URL

# Run the create_admin.py script (--yes for non-interactive)
python3 create_admin.py --email "$EMAIL" --password "$PASSWORD" --name "$NAME" --yes

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Admin account created successfully in production database!${NC}"
    echo ""
    echo -e "${BLUE}📝 You can now log in to the TestFlight app with:${NC}"
    echo "   Email: $EMAIL"
    echo "   Password: $PASSWORD"
    echo ""
    echo -e "${BLUE}🔐 Next steps:${NC}"
    echo "1. Try logging in to your iOS TestFlight app"
    echo "2. The login should work now with the production database"
else
    echo ""
    echo -e "${RED}❌ Failed to create admin account${NC}"
    echo ""
    echo "Common issues:"
    echo "  • Database connection failed - check DATABASE_URL"
    echo "  • Cloud SQL Proxy not running (if using Unix socket)"
    echo "  • Network/firewall blocking connection"
    exit 1
fi
