#!/bin/bash
# Script to sync all necessary environment variables from .env to Railway
# This syncs only the variables needed for the application to work

echo "🔄 Syncing environment variables from .env to Railway..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Check if logged in to Railway
if ! railway whoami &>/dev/null; then
    echo "❌ Not logged in to Railway. Run: railway login"
    exit 1
fi

echo "📋 Variables to sync:"
echo ""

# Required variables for the application
REQUIRED_VARS=(
    # Security & Auth
    "SECRET_KEY"
    "JWT_ALGORITHM"
    "JWT_ACCESS_TOKEN_EXPIRE_MINUTES"
    "JWT_REFRESH_TOKEN_EXPIRE_DAYS"
    
    # AI Configuration
    "OPENAI_API_KEY"
    "AI_PROVIDER"
    "AI_MODEL"
    "ANTHROPIC_API_KEY"
    
    # OCR Configuration (if using Google Cloud Vision)
    "GOOGLE_APPLICATION_CREDENTIALS"
    
    # Optional AI settings
    "AI_TEMPERATURE"
    "AI_MAX_TOKENS"
    "AI_TIMEOUT"
    "AI_MIN_CONFIDENCE"
    
    # Optional OCR settings
    "OCR_PREFERRED_BACKEND"
    "OCR_CONFIDENCE_THRESHOLD"
)

# Counters
SET_COUNT=0
SKIP_COUNT=0
MISSING_COUNT=0

# Process each variable
for VAR in "${REQUIRED_VARS[@]}"; do
    # Extract value from .env
    VALUE=$(grep "^${VAR}=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    if [ -z "$VALUE" ]; then
        echo "⚠️  $VAR - Not found in .env (skipping)"
        MISSING_COUNT=$((MISSING_COUNT + 1))
        continue
    fi
    
    # Check if it's a file path (GOOGLE_APPLICATION_CREDENTIALS)
    if [ "$VAR" = "GOOGLE_APPLICATION_CREDENTIALS" ] && [ -f "$VALUE" ]; then
        echo "📄 $VAR - File path detected: $VALUE"
        echo "   ⚠️  Note: Railway needs the JSON content, not file path"
        echo "   💡 You'll need to set this manually via Railway dashboard"
        echo "   💡 Or use: railway variables --set GOOGLE_APPLICATION_CREDENTIALS='$(cat "$VALUE" | jq -c .)'"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        continue
    fi
    
    # Set the variable
    echo "✅ Setting $VAR..."
    if railway variables --set "${VAR}=${VALUE}" &>/dev/null; then
        SET_COUNT=$((SET_COUNT + 1))
    else
        echo "   ❌ Failed to set $VAR"
        SKIP_COUNT=$((SKIP_COUNT + 1))
    fi
done

echo ""
echo "📊 Summary:"
echo "   ✅ Set: $SET_COUNT variables"
echo "   ⚠️  Skipped: $SKIP_COUNT variables"
echo "   ❌ Missing: $MISSING_COUNT variables"
echo ""
echo "🚀 Railway will automatically redeploy."
echo ""
echo "📋 Verify with: railway variables"
echo "📋 Check logs with: railway logs"

