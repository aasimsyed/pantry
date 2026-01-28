#!/bin/bash
set -e

# iOS Build & Upload Script for Smart Pantry
# Usage: ./build-ios.sh

cd "$(dirname "$0")"

echo "🔧 Step 1: Running expo prebuild..."
npx expo prebuild --platform ios --clean

echo "🔧 Step 2: Disabling User Script Sandboxing..."
# Disable sandboxing in the Xcode project (required for React Native)
sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES/ENABLE_USER_SCRIPT_SANDBOXING = NO/g' \
    ios/SmartPantryAI.xcodeproj/project.pbxproj 2>/dev/null || true

echo "📦 Step 3: Building archive..."
ARCHIVE_PATH="$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/SmartPantryAI-$(date +%H%M%S).xcarchive"
mkdir -p "$(dirname "$ARCHIVE_PATH")"

xcodebuild archive \
    -workspace ios/SmartPantryAI.xcworkspace \
    -scheme SmartPantryAI \
    -configuration Release \
    -destination "generic/platform=iOS" \
    -archivePath "$ARCHIVE_PATH" \
    CODE_SIGN_STYLE=Automatic \
    DEVELOPMENT_TEAM=K5A25879TB \
    -quiet

echo "✅ Archive created: $ARCHIVE_PATH"

echo "📤 Step 4: Exporting for App Store..."
EXPORT_PATH="/tmp/SmartPantryAI-export"
rm -rf "$EXPORT_PATH"

# Create export options plist
cat > /tmp/ExportOptions.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>destination</key>
    <string>upload</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>teamID</key>
    <string>K5A25879TB</string>
    <key>uploadSymbols</key>
    <true/>
</dict>
</plist>
EOF

xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportOptionsPlist /tmp/ExportOptions.plist \
    -exportPath "$EXPORT_PATH" \
    -quiet

echo ""
echo "🎉 Build complete and uploaded to App Store Connect!"
echo "📱 Check TestFlight in ~10-30 minutes for the new build."
echo ""
echo "Archive location: $ARCHIVE_PATH"
