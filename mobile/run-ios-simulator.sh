#!/bin/bash
# Build for generic iOS Simulator and install on a booted simulator.
# Use when Xcode's destination dropdown doesn't show simulators.
# Prereq: Start at least one iOS Simulator (e.g. iPhone 17 Pro) and have Metro running in another terminal.

set -e
cd "$(dirname "$0")"

WORKSPACE="ios/SmartPantryAI.xcworkspace"
SCHEME="SmartPantryAI"
BUILD_DIR="ios/build"
APP_PATH="${BUILD_DIR}/Build/Products/Debug-iphonesimulator/SmartPantryAI.app"

# Find a booted simulator
BOOTED=$(xcrun simctl list devices | grep "Booted" | head -1)
if [ -z "$BOOTED" ]; then
  echo "No simulator is booted. Open Simulator.app and boot an iPhone (File → Open Simulator → iOS 18.x → iPhone 17 Pro)."
  exit 1
fi

# Extract UDID (first UUID in the line)
UDID=$(echo "$BOOTED" | sed -n 's/.*(\([A-F0-9-]*\)) (Booted).*/\1/p')
if [ -z "$UDID" ]; then
  UDID=$(echo "$BOOTED" | grep -oE '[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}')
fi

echo "Booted simulator: $BOOTED"
echo "UDID: $UDID"

# Install pods without ML Kit so simulator build can link (MLImage.framework is device-only).
# For device builds, run: cd ios && pod install (no SIMULATOR_BUILD) so Scan Label works.
echo "Installing pods for simulator (ML Kit excluded)..."
(cd ios && SIMULATOR_BUILD=1 pod install)

# Clean build products only; keep ios/build/generated (codegen outputs from pod install)
echo "Cleaning previous build products..."
rm -rf "${BUILD_DIR}/Build"

echo "Building for iOS Simulator (arm64 for Apple Silicon)..."
# EXCLUDED_ARCHS= clears project/pod exclusion of arm64 so ARCHS=arm64 is valid for simulator
# SENTRY_ALLOW_FAILURE=true so Sentry upload (blocked by sandbox reading sentry.properties) does not fail the build
SENTRY_ALLOW_FAILURE=true xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath "$BUILD_DIR" \
  ARCHS=arm64 EXCLUDED_ARCHS= \
  -quiet

if [ ! -d "$APP_PATH" ]; then
  echo "Build failed or .app not found at $APP_PATH"
  exit 1
fi

echo "Installing on simulator..."
xcrun simctl install "$UDID" "$APP_PATH"

echo "Launching app..."
xcrun simctl launch "$UDID" com.aasimsyed.smartpantry

echo "Done. Ensure Metro is running in another terminal (e.g. EXPO_PUBLIC_API_URL=... npx expo start)."
