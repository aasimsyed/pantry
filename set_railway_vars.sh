#!/bin/bash

echo "🔐 Setting Railway Security Variables..."
echo ""

# Check if logged in
if ! railway whoami &>/dev/null; then
    echo "❌ Not logged in to Railway. Please run: railway login"
    exit 1
fi

echo "✅ Logged in to Railway"
echo ""

# Generate secret key
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
echo "Generated SECRET_KEY: ${SECRET_KEY:0:20}..."

# Set variables
echo ""
echo "Setting variables..."
railway variables --set SECRET_KEY="$SECRET_KEY" 2>&1
railway variables --set JWT_ALGORITHM=HS256 2>&1
railway variables --set JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15 2>&1
railway variables --set JWT_REFRESH_TOKEN_EXPIRE_DAYS=30 2>&1

echo ""
echo "✅ Variables set! Verifying..."
railway variables | grep -E "SECRET_KEY|JWT_" || echo "Run 'railway variables' to see all variables"

echo ""
echo "✅ Done! Railway will auto-redeploy with new variables."
