#!/bin/bash
# Script to set AI API keys on Railway
# Make sure you're logged in: railway login

echo "🔧 Setting AI API keys on Railway..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file with your API keys first."
    exit 1
fi

# Extract values from .env
OPENAI_KEY=$(grep "^OPENAI_API_KEY=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
AI_PROVIDER=$(grep "^AI_PROVIDER=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
AI_MODEL=$(grep "^AI_MODEL=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
ANTHROPIC_KEY=$(grep "^ANTHROPIC_API_KEY=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")

# Check if keys are set
if [ -z "$OPENAI_KEY" ]; then
    echo "❌ OPENAI_API_KEY not found in .env"
    exit 1
fi

if [ -z "$AI_PROVIDER" ]; then
    echo "⚠️  AI_PROVIDER not set, defaulting to 'openai'"
    AI_PROVIDER="openai"
fi

if [ -z "$AI_MODEL" ]; then
    echo "⚠️  AI_MODEL not set, defaulting to 'gpt-4-turbo-preview'"
    AI_MODEL="gpt-4-turbo-preview"
fi

echo "📝 Setting variables on Railway..."
echo ""

# Set OpenAI API key
echo "Setting OPENAI_API_KEY..."
railway variables --set "OPENAI_API_KEY=$OPENAI_KEY"

# Set AI provider
echo "Setting AI_PROVIDER=$AI_PROVIDER..."
railway variables --set "AI_PROVIDER=$AI_PROVIDER"

# Set AI model
echo "Setting AI_MODEL=$AI_MODEL..."
railway variables --set "AI_MODEL=$AI_MODEL"

# Set Anthropic key if present (optional)
if [ -n "$ANTHROPIC_KEY" ]; then
    echo "Setting ANTHROPIC_API_KEY..."
    railway variables --set "ANTHROPIC_API_KEY=$ANTHROPIC_KEY"
else
    echo "⚠️  ANTHROPIC_API_KEY not found in .env (optional, skipping)"
fi

echo ""
echo "✅ Done! Railway will automatically redeploy."
echo ""
echo "📊 Verify with: railway variables | grep -E 'OPENAI|ANTHROPIC|AI_PROVIDER|AI_MODEL'"
echo "📋 Check logs with: railway logs"

