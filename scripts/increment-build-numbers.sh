#!/bin/bash
# Auto-increment iOS buildNumber and Android versionCode in app.json
# This script increments build numbers and commits the changes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_JSON="$PROJECT_ROOT/mobile/app.json"

if [ ! -f "$APP_JSON" ]; then
  echo "Error: app.json not found at $APP_JSON"
  exit 1
fi

# Read current build numbers (iOS is string, Android is number)
CURRENT_IOS_BUILD=$(node -e "const config = require('$APP_JSON'); const num = parseInt(config.expo.ios.buildNumber || '1', 10); console.log(num)")
CURRENT_ANDROID_VERSION=$(node -e "const config = require('$APP_JSON'); console.log(config.expo.android.versionCode || 1)")

# Increment build numbers
NEW_IOS_BUILD=$((CURRENT_IOS_BUILD + 1))
NEW_ANDROID_VERSION=$((CURRENT_ANDROID_VERSION + 1))

echo "Current iOS buildNumber: $CURRENT_IOS_BUILD -> New: $NEW_IOS_BUILD"
echo "Current Android versionCode: $CURRENT_ANDROID_VERSION -> New: $NEW_ANDROID_VERSION"

# Update app.json using Node.js
node <<EOF
const fs = require('fs');
const path = '$APP_JSON';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));

// iOS buildNumber must be a string, Android versionCode is a number
config.expo.ios.buildNumber = '$NEW_IOS_BUILD';
config.expo.android.versionCode = $NEW_ANDROID_VERSION;

fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
console.log('Updated app.json with new build numbers');
EOF

echo "✅ Build numbers incremented successfully"
echo "   iOS buildNumber: $NEW_IOS_BUILD"
echo "   Android versionCode: $NEW_ANDROID_VERSION"
