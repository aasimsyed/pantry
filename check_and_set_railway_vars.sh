#!/bin/bash

echo "🔐 Railway Security Variables Setup"
echo "===================================="
echo ""

# Check login
if ! railway whoami &>/dev/null; then
    echo "❌ Not logged in to Railway"
    echo ""
    echo "Please run: railway login"
    echo "This will open a browser for authentication."
    exit 1
fi

echo "✅ Logged in as: $(railway whoami)"
echo ""

# Check current variables
echo "📋 Current Security Variables:"
railway variables 2>&1 | grep -E "SECRET_KEY|JWT_" || echo "  (none found)"
echo ""

# Ask if user wants to set/update
read -p "Do you want to set/update security variables? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Skipped. Variables unchanged."
    exit 0
fi

# Generate secret key
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
echo ""
echo "🔑 Generated new SECRET_KEY: ${SECRET_KEY:0:30}..."
echo ""

# Set variables
echo "Setting variables..."
railway variables --set "SECRET_KEY=$SECRET_KEY" 2>&1 | grep -v "^$" || true
railway variables --set "JWT_ALGORITHM=HS256" 2>&1 | grep -v "^$" || true
railway variables --set "JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15" 2>&1 | grep -v "^$" || true
railway variables --set "JWT_REFRESH_TOKEN_EXPIRE_DAYS=30" 2>&1 | grep -v "^$" || true

echo ""
echo "✅ Variables set! Verifying..."
echo ""
railway variables 2>&1 | grep -E "SECRET_KEY|JWT_" || echo "Run 'railway variables' to see all"

echo ""
echo "✅ Done! Railway will auto-redeploy with new variables."
echo "   Check deployment status in Railway dashboard."
