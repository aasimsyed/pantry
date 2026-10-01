#!/bin/bash
# iOS Build & Upload Script for Smart Pantry (no EAS required)
# Usage: ./build-ios.sh                  # build + upload to TestFlight
#        ./build-ios.sh --build-only     # build IPA only (no upload)
#
# Config: copy mobile/.env.build.example to mobile/.env.build and fill in values.
# Required: APPLE_TEAM_ID
# Upload (choose one):
#   Option A - App Store Connect API Key (recommended):
#     APP_STORE_CONNECT_API_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_API_KEY_PATH
#   Option B - Apple ID + app-specific password:
#     APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env.build if present
if [ -f ".env.build" ]; then
  set -a
  source ".env.build"
  set +a
fi

BUILD_ONLY=false
for arg in "$@"; do
  [ "$arg" = "--build-only" ] && BUILD_ONLY=true
done

# Credentials (fall back to env vars set by caller or GitHub Actions)
TEAM_ID="${APPLE_TEAM_ID:-K5A25879TB}"
API_KEY_ID="${APP_STORE_CONNECT_API_KEY_ID:-}"
API_ISSUER_ID="${APP_STORE_CONNECT_ISSUER_ID:-}"
API_KEY_PATH="${APP_STORE_CONNECT_API_KEY_PATH:-}"
APPLE_ID="${APPLE_ID:-}"
APP_SPECIFIC_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD:-}"

BUILD_OUT="$SCRIPT_DIR/ios/build"
mkdir -p "$BUILD_OUT"

echo "=== Smart Pantry iOS Build & TestFlight Script ==="
echo ""

# [1/7] Auto-increment build number and commit
echo "[1/7] Incrementing build number..."
BUILD_NUM=$(node -e "
  const fs = require('fs');
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const current = parseInt(app.expo?.ios?.buildNumber || '1', 10);
  const next = current + 1;
  app.expo.ios.buildNumber = String(next);
  fs.writeFileSync('app.json', JSON.stringify(app, null, 2));
  console.log(current + ' -> ' + next);
")
echo "  Build number: $BUILD_NUM"
NEW_NUM="${BUILD_NUM##* -> }"
git add app.json
git diff --cached --quiet || git commit -m "Bump iOS build number to $NEW_NUM"

# [2/7] Prebuild (SENTRY_ALLOW_FAILURE prevents sentry-cli from failing the build)
echo "[2/7] Running expo prebuild..."
SENTRY_ALLOW_FAILURE=true npx expo prebuild --platform ios --clean

# [2b/7] Ensure 1024x1024 App Store icon in xcassets
echo "[2b/7] Ensuring App Store icon (1024x1024)..."
node scripts/ensure-app-icon-1024.js

# [3/7] Pod install
echo "[3/7] Installing CocoaPods..."
(cd ios && pod install)

# Detect workspace and scheme
WORKSPACE_PATH=$(find ios -maxdepth 1 -name "*.xcworkspace" -print -quit)
if [ -z "$WORKSPACE_PATH" ]; then
  echo "❌ No .xcworkspace found in ios/"
  exit 1
fi
WORKSPACE_NAME=$(basename "$WORKSPACE_PATH" .xcworkspace)

if command -v jq &>/dev/null; then
  SCHEMES_JSON=$(xcodebuild -list -workspace "$WORKSPACE_PATH" -json 2>/dev/null)
  EXCLUDE_SCHEMES='EXConstants|^Pods-|^React|^RCT|^DoubleConversion|^glog|^Folly|^hermes|^libevent'
  ALL_SCHEMES=$(echo "$SCHEMES_JSON" | jq -r '.workspace.schemes[]? // .project.schemes[]? // empty' 2>/dev/null)
  SCHEME=$(echo "$ALL_SCHEMES" | grep -Fx "$WORKSPACE_NAME" 2>/dev/null | head -1)
  [ -z "$SCHEME" ] && SCHEME=$(echo "$ALL_SCHEMES" | grep -vE "$EXCLUDE_SCHEMES" 2>/dev/null | head -1)
  [ -z "$SCHEME" ] && SCHEME="$WORKSPACE_NAME"
else
  SCHEME="$WORKSPACE_NAME"
fi
echo "  Workspace: $WORKSPACE_NAME  Scheme: $SCHEME"

PROJECT_PATH="ios/${WORKSPACE_NAME}.xcodeproj/project.pbxproj"

# Disable User Script Sandboxing (Expo plugin compatibility)
if [ -f "$PROJECT_PATH" ]; then
  sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES/ENABLE_USER_SCRIPT_SANDBOXING = NO/g' "$PROJECT_PATH" 2>/dev/null || true
fi

# Skip Install=YES for Pods so archive contains only .app, not libs (avoids "generic archive" error)
find ios -name "project.pbxproj" -path "*/Pods/*" \
  -exec sed -i '' 's/SKIP_INSTALL = NO/SKIP_INSTALL = YES/g' {} \; 2>/dev/null || true

# For GitHub Actions: verify a distribution cert is present (installed by the workflow before this script runs)
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  FOUND=$(security find-identity -v -p codesigning 2>/dev/null | grep "$TEAM_ID" | grep -i distribution | head -1)
  if [ -z "$FOUND" ]; then
    echo "::error::No distribution identity found for team $TEAM_ID."
    echo "You need an Apple Distribution certificate (.p12) installed in the keychain."
    security find-identity -v -p codesigning 2>/dev/null || true
    exit 1
  fi
fi

# [4/7] Archive
echo "[4/7] Building archive (this may take several minutes)..."
ARCHIVE_PATH="$BUILD_OUT/${WORKSPACE_NAME}-$(date +%Y%m%d-%H%M%S).xcarchive"

ARCHIVE_ARGS=(
  -workspace "$WORKSPACE_PATH"
  -scheme "$SCHEME"
  -configuration Release
  -destination "generic/platform=iOS"
  -archivePath "$ARCHIVE_PATH"
  -allowProvisioningUpdates
  DEVELOPMENT_TEAM="$TEAM_ID"
)
if [ -n "${PROVISIONING_PROFILE_SPECIFIER:-}" ]; then
  ARCHIVE_ARGS+=(CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="Apple Distribution" PROVISIONING_PROFILE_SPECIFIER="$PROVISIONING_PROFILE_SPECIFIER")
else
  ARCHIVE_ARGS+=(CODE_SIGN_STYLE=Automatic)
fi

# Export as env var so xcodebuild script phases inherit it (build setting args don't propagate to scripts)
export SENTRY_ALLOW_FAILURE=true
xcodebuild archive "${ARCHIVE_ARGS[@]}"
echo "  Archive: $ARCHIVE_PATH"

# [5/7] Export IPA
echo "[5/7] Exporting IPA..."
EXPORT_PATH="$BUILD_OUT/export-$(date +%Y%m%d-%H%M%S)"
EXPORT_PLIST="$BUILD_OUT/ExportOptions.plist"

cat > "$EXPORT_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>teamID</key>
  <string>$TEAM_ID</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>uploadSymbols</key>
  <false/>
</dict>
</plist>
EOF

if [ -n "${PROVISIONING_PROFILE_NAME:-}" ] || [ -n "${PROVISIONING_PROFILE_SPECIFIER:-}" ]; then
  PROFILE_VALUE="${PROVISIONING_PROFILE_NAME:-$PROVISIONING_PROFILE_SPECIFIER}"
  /usr/libexec/PlistBuddy "$EXPORT_PLIST" \
    -c "Set :signingStyle manual" \
    -c "Add :provisioningProfiles dict" \
    -c "Add :provisioningProfiles:com.aasimsyed.smartpantry string $PROFILE_VALUE" 2>/dev/null || true
fi

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -exportPath "$EXPORT_PATH" \
  -allowProvisioningUpdates

IPA_PATH=$(find "$EXPORT_PATH" -maxdepth 1 -name "*.ipa" -print -quit)
if [ -z "$IPA_PATH" ]; then
  echo "❌ No .ipa found in $EXPORT_PATH"
  exit 1
fi

echo ""
echo "✅ Build complete."
echo "   IPA: $IPA_PATH"
echo ""

if [ "$BUILD_ONLY" = true ]; then
  echo "Skipping upload (--build-only)."
  echo "To submit manually: open Transporter (Mac App Store) and drag in:"
  echo "  $IPA_PATH"
  exit 0
fi

# [6/7] Verify archive (quick sanity check)
echo "[6/7] Verifying archive..."
ls -la "$ARCHIVE_PATH/Products/Applications/" 2>/dev/null || echo "  (No Products/Applications dir)"

# [7/7] Upload to TestFlight
echo "[7/7] Uploading to TestFlight..."
UPLOAD_SUCCESS=false

if [ -n "$API_KEY_ID" ] && [ -n "$API_ISSUER_ID" ] && [ -n "$API_KEY_PATH" ] && [ -f "$API_KEY_PATH" ]; then
  echo "  Using App Store Connect API Key..."
  if xcrun altool --upload-app \
    --type ios \
    --file "$IPA_PATH" \
    --apiKey "$API_KEY_ID" \
    --apiIssuer "$API_ISSUER_ID" \
    --apiKeyPath "$API_KEY_PATH"; then
    UPLOAD_SUCCESS=true
  fi
elif [ -n "$APPLE_ID" ] && [ -n "$APP_SPECIFIC_PASSWORD" ]; then
  echo "  Using Apple ID + app-specific password..."
  if xcrun altool --upload-app \
    --type ios \
    --file "$IPA_PATH" \
    --username "$APPLE_ID" \
    --password "$APP_SPECIFIC_PASSWORD"; then
    UPLOAD_SUCCESS=true
  fi
else
  echo "  No upload credentials configured."
  echo ""
  echo "  Add to mobile/.env.build (choose one):"
  echo ""
  echo "  Option A - App Store Connect API Key (recommended):"
  echo "    APP_STORE_CONNECT_API_KEY_ID=XXXXXXXXXX"
  echo "    APP_STORE_CONNECT_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  echo "    APP_STORE_CONNECT_API_KEY_PATH=/path/to/AuthKey_XXXXXXXXXX.p8"
  echo ""
  echo "  Option B - Apple ID + app-specific password:"
  echo "    APPLE_ID=aasim.ss@gmail.com"
  echo "    APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx"
fi

if [ "$UPLOAD_SUCCESS" = true ]; then
  echo ""
  echo "🎉 Upload complete. Build will appear in TestFlight in 10-30 minutes."
  echo "   https://appstoreconnect.apple.com/apps/6755445323/testflight/ios"
else
  echo ""
  echo "  Upload failed or skipped. To submit manually:"
  echo "    1. Open Transporter (Mac App Store)"
  echo "    2. Drag: $IPA_PATH"
  echo "    3. Click Deliver"
  echo ""
  echo "📱 Archive: $ARCHIVE_PATH"
  exit 1
fi

echo ""
echo "📱 Archive: $ARCHIVE_PATH"
