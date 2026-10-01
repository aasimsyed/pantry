#!/usr/bin/env bash
# Run iOS E2E: use running simulator (or chosen device); build and install latest app automatically.
# If both simulator and physical device are available and no flag given, prompts: [D]evice or [S]imulator.
# Usage: ./scripts/run-e2e-ios.sh [--device | --simulator] [--skip-build] [--a11y]
set -e
set -o pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$(cd "$E2E_DIR/../mobile" && pwd)"
BUNDLE_ID="com.aasimsyed.smartpantry"

USE_DEVICE=false
SKIP_BUILD=false
RUN_A11Y=false
for arg in "$@"; do
  case "$arg" in
    --device)    USE_DEVICE=true ;;
    --simulator) USE_DEVICE=false ;;
    --skip-build) SKIP_BUILD=true ;;
    --a11y)      RUN_A11Y=true ;;
  esac
done

# List physical devices (UDID and name) from xcrun xctrace
get_physical_devices() {
  xcrun xctrace list devices 2>/dev/null | awk '
    /^== Devices ==/ { d=1; next }
    /^== / { d=0 }
    d && $0 && !/Simulator/ && !/yoda/ && /\([0-9A-Fa-f-]{25,}\)/ {
      # line like "iPhone (26.2) (00008140-...)" or "Name (UDID)"
      match($0, /\([0-9A-Fa-f-]{25,}\)/);
      udid = substr($0, RSTART+1, RLENGTH-2);
      name = $0;
      sub(/ *\([^)]*\) *$/, "", name);
      print udid "|" name
      exit
    }
  '
}

# Get first booted simulator UDID and OS version
get_booted_simulator() {
  xcrun simctl list devices available 2>/dev/null | awk '
    /Booted/ {
      # line like "    iPhone 11 Pro Max (AFB8FC0A-...) (Booted)"
      match($0, /\([0-9A-F-]{36}\) \(Booted\)/);
      if (RSTART) {
        udid = substr($0, RSTART+1, 36);
        name = $0;
        sub(/^[[:space:]]+/, "", name);
        sub(/ \([0-9A-F-]{36}\).*/, "", name);
        print udid "|" name
        exit
      }
    }
  '
}

# Pick simulator when none booted: use first available iPhone
get_any_simulator() {
  xcrun simctl list devices available 2>/dev/null | awk -v ver="26.2" '
    /iPhone/ && /26\.2/ {
      match($0, /\([0-9A-F-]{36}\)/)
      if (RSTART) {
        udid = substr($0, RSTART+1, 36)
        name = $0
        sub(/^[[:space:]]+/, "", name)
        sub(/ \([0-9A-F-]{36}\).*/, "", name)
        print udid "|" name "|" ver
        exit
      }
    }
  '
}

# Ensure app is installed: always build and install latest unless --skip-build
ensure_app_installed() {
  if "$SKIP_BUILD"; then
    echo "Skipping build (--skip-build). App must already be installed."
    return 0
  fi
  echo "Building and installing latest app (this may take 1–2 minutes)..."
  mkdir -p "$E2E_DIR/e2e-logs"
  if "$USE_DEVICE"; then
    (cd "$MOBILE_DIR" && npx expo run:ios --device 2>&1 | tee "$E2E_DIR/e2e-logs/expo-run-ios.log") &
    EXPO_PID=$!
    for i in $(seq 1 150); do
      sleep 1
      if ! kill -0 "$EXPO_PID" 2>/dev/null; then
        break
      fi
      if grep -q "Build Succeeded\|Successfully built\|Installing\|Launching" "$E2E_DIR/e2e-logs/expo-run-ios.log" 2>/dev/null; then
        sleep 15
        kill "$EXPO_PID" 2>/dev/null || true
        wait "$EXPO_PID" 2>/dev/null || true
        break
      fi
    done
    kill "$EXPO_PID" 2>/dev/null || true
    wait "$EXPO_PID" 2>/dev/null || true
  else
    # Simulator: use run-ios-simulator.sh so xcodebuild uses generic/platform=iOS Simulator
    # (avoids "Unable to find a destination" when booted sim UDID isn't in xcodebuild's list)
    if [[ ! -x "$MOBILE_DIR/run-ios-simulator.sh" ]]; then
      echo "Simulator build script not found or not executable: $MOBILE_DIR/run-ios-simulator.sh"
      echo "Falling back to expo run:ios (may fail if xcodebuild cannot see simulator UDID)."
      (cd "$MOBILE_DIR" && npx expo run:ios 2>&1 | tee "$E2E_DIR/e2e-logs/expo-run-ios.log") &
      EXPO_PID=$!
      for i in $(seq 1 150); do
        sleep 1
        if ! kill -0 "$EXPO_PID" 2>/dev/null; then
          break
        fi
        if grep -q "Build Succeeded\|Successfully built\|Installing\|Launching" "$E2E_DIR/e2e-logs/expo-run-ios.log" 2>/dev/null; then
          sleep 15
          kill "$EXPO_PID" 2>/dev/null || true
          wait "$EXPO_PID" 2>/dev/null || true
          break
        fi
      done
      kill "$EXPO_PID" 2>/dev/null || true
      wait "$EXPO_PID" 2>/dev/null || true
    else
      (cd "$MOBILE_DIR" && ./run-ios-simulator.sh) 2>&1 | tee "$E2E_DIR/e2e-logs/expo-run-ios.log"
    fi
  fi
  echo "App install step finished."
}

# Start Appium if not already running
start_appium_if_needed() {
  if curl -s http://127.0.0.1:4723/status >/dev/null 2>&1; then
    echo "Appium already running on 4723."
    return 0
  fi
  mkdir -p "$E2E_DIR/e2e-logs"
  echo "Starting Appium..."
  (cd "$E2E_DIR" && node node_modules/appium/build/lib/main.js --address 127.0.0.1 --port 4723 >> e2e-logs/appium.log 2>&1 &)
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    if curl -s http://127.0.0.1:4723/status >/dev/null 2>&1; then
      echo "Appium is ready."
      return 0
    fi
  done
  echo "Appium failed to start. Check e2e-logs/appium.log"
  return 1
}

# --- Main ---
cd "$E2E_DIR"

PHYSICAL=$(get_physical_devices)
BOOTED=$(get_booted_simulator)

# If neither --device nor --simulator was passed and we have both, ask
CHOSE_TARGET=false
for a in "$@"; do [[ "$a" == --device ]] && CHOSE_TARGET=true; [[ "$a" == --simulator ]] && CHOSE_TARGET=true; done
if [[ "$CHOSE_TARGET" != true ]]; then
  if [[ -n "$PHYSICAL" && ( -n "$BOOTED" || -n "$(get_any_simulator)" ) ]]; then
    echo "Connected device and simulator available."
    echo -n "Run on [D]evice or [S]imulator? (d/s): "
    read -r choice
    case "${choice,,}" in
      d|device)   USE_DEVICE=true ;;
      s|sim)      USE_DEVICE=false ;;
      *)          echo "Using simulator (default)."; USE_DEVICE=false ;;
    esac
  elif [[ -n "$PHYSICAL" ]]; then
    echo "Using connected physical device."
    USE_DEVICE=true
  else
    echo "Using simulator."
    USE_DEVICE=false
  fi
fi

if "$USE_DEVICE"; then
  if [[ -z "$PHYSICAL" ]]; then
    echo "No physical device found. Connect a device or use --simulator."
    exit 1
  fi
  IFS='|' read -r IOS_UDID IOS_DEVICE_NAME <<< "$PHYSICAL"
  export IOS_UDID
  export IOS_DEVICE_NAME
  export IOS_PLATFORM_VERSION
  IOS_PLATFORM_VERSION="${IOS_PLATFORM_VERSION:-26.2}"
  echo "Target device: $IOS_DEVICE_NAME ($IOS_UDID)"
  ensure_app_installed
else
  export IOS_PLATFORM_VERSION="${IOS_PLATFORM_VERSION:-26.2}"
  if [[ -n "$BOOTED" ]]; then
    IFS='|' read -r SIM_UDID SIM_NAME <<< "$BOOTED"
    export IOS_UDID="$SIM_UDID"
    export IOS_DEVICE_NAME="$SIM_NAME"
  else
    ANY=$(get_any_simulator)
    if [[ -n "$ANY" ]]; then
      IFS='|' read -r SIM_UDID SIM_NAME SIM_VER <<< "$ANY"
      echo "No booted simulator. Booting: $SIM_NAME"
      xcrun simctl boot "$SIM_UDID" 2>/dev/null || true
      export IOS_UDID="$SIM_UDID"
      export IOS_DEVICE_NAME="$SIM_NAME"
      export IOS_PLATFORM_VERSION="${SIM_VER:-26.2}"
    fi
  fi
  echo "Target simulator: ${IOS_DEVICE_NAME:-iPhone} (${IOS_UDID:-default})"
  ensure_app_installed
fi

start_appium_if_needed || exit 1

if "$RUN_A11Y"; then
  echo "Running E2E accessibility audit only..."
  RUN_APPIUM_EXTERNAL=1 npm run e2e:a11y
else
  echo "Running full E2E (register, login, feature + a11y, delete user)..."
  RUN_APPIUM_EXTERNAL=1 npm run e2e:full
fi
