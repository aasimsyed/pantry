#!/bin/bash
# Script to set Google Cloud Vision credentials on Railway
# This reads the JSON file and sets it as an environment variable

echo "🔧 Setting up Google Cloud Vision on Railway..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Extract credentials file path from .env
GOOGLE_CREDS=$(grep "^GOOGLE_APPLICATION_CREDENTIALS=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

if [ -z "$GOOGLE_CREDS" ]; then
    echo "❌ GOOGLE_APPLICATION_CREDENTIALS not found in .env"
    echo ""
    echo "Please add to .env:"
    echo "GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/credentials.json"
    exit 1
fi

if [ ! -f "$GOOGLE_CREDS" ]; then
    echo "❌ Credentials file not found: $GOOGLE_CREDS"
    echo ""
    echo "Please check the path in your .env file"
    exit 1
fi

echo "✅ Found credentials file: $GOOGLE_CREDS"
echo ""

# Check if jq is available (for JSON validation)
if command -v jq &> /dev/null; then
    echo "🔍 Validating JSON..."
    if ! jq empty "$GOOGLE_CREDS" 2>/dev/null; then
        echo "⚠️  Warning: JSON validation failed, but continuing anyway..."
    else
        echo "✅ JSON is valid"
    fi
    echo ""
fi

# Read the JSON file and set it on Railway
echo "📤 Setting GOOGLE_APPLICATION_CREDENTIALS on Railway..."
echo "   (This may take a moment - JSON content is large)"
echo ""

# Use jq to compact the JSON if available, otherwise use cat
if command -v jq &> /dev/null; then
    JSON_CONTENT=$(jq -c . "$GOOGLE_CREDS")
else
    # Remove whitespace manually (basic)
    JSON_CONTENT=$(cat "$GOOGLE_CREDS" | tr -d '\n' | tr -d ' ')
fi

# Set on Railway web service
if railway variables --service web --set "GOOGLE_APPLICATION_CREDENTIALS=$JSON_CONTENT" 2>&1; then
    echo ""
    echo "✅ Google Cloud Vision credentials set successfully!"
    echo ""
    echo "🚀 Railway will automatically redeploy."
    echo ""
    echo "📋 Verify with: railway variables | grep GOOGLE"
    echo "📋 Check logs with: railway logs"
    echo ""
    echo "💡 Note: Railway stores this as an environment variable, not a file."
    echo "   The application will read it from the environment."
else
    echo ""
    echo "❌ Failed to set credentials on Railway"
    echo ""
    echo "💡 Alternative: Set manually via Railway Dashboard:"
    echo "   1. Go to Railway Dashboard → Your Service → Variables"
    echo "   2. Add variable: GOOGLE_APPLICATION_CREDENTIALS"
    echo "   3. Paste the entire JSON content as the value"
    exit 1
fi

