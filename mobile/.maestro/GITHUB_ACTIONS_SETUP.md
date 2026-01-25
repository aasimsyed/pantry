# GitHub Actions Setup for Maestro Tests

## Overview

This workflow runs Maestro E2E tests in GitHub Actions **completely FREE** using self-hosted simulators.

## What the Workflow Does

1. ✅ **Boots iOS Simulator** - Automatically finds and boots an available iPhone simulator
2. ✅ **Builds Development App** - Creates a development build via EAS (takes ~10-20 min)
3. ✅ **Downloads Build** - Gets the .app file from EAS
4. ✅ **Installs on Simulator** - Installs the app automatically
5. ✅ **Runs Maestro Tests** - Executes all tests in `.maestro/` directory
6. ✅ **Uploads Results** - Saves test results and screenshots as artifacts

## Prerequisites

1. **GitHub Secret**: `EXPO_TOKEN` ✅ **Already configured!**
   - Your existing `build-mobile-ios.yml` workflow already uses this
   - No additional setup needed

2. **EAS Account**: Already configured ✅

## Cost

**100% FREE** - Uses GitHub Actions free tier:
- Public repos: Unlimited minutes
- Private repos: 2,000 minutes/month free

Each test run takes ~15-25 minutes (mostly build time).

## Workflow File

Located at: `.github/workflows/maestro-tests.yml`

## How It Works

### Step-by-Step

1. **Simulator Setup**
   ```bash
   # Finds available iPhone simulator
   # Boots it headlessly (no visible window)
   ```

2. **Build App**
   ```bash
   eas build --profile development --platform ios --wait
   # Waits for build to complete (~10-20 min)
   ```

3. **Download & Install**
   ```bash
   # Downloads .tar.gz from EAS
   # Extracts .app file
   # Installs via: xcrun simctl install
   ```

4. **Run Tests**
   ```bash
   maestro test .maestro/ --device "iPhone 15 Pro"
   ```

## Optimization Tips

### Option 1: Reuse Existing Builds (Faster)

Instead of building every time, you could:
- Check for recent builds first
- Only build if no recent build exists
- Saves ~15 minutes per run

### Option 2: Cache Builds

- Store built .app files as artifacts
- Reuse if code hasn't changed
- Requires more complex logic

### Option 3: Build in Separate Job

- Build in one job
- Test in parallel jobs
- Good for multiple test suites

## Troubleshooting

### "No booted simulator found"
- Check device name matches available simulators
- Workflow auto-detects available devices
- Check logs for: `Available simulators:`

### "Could not get build URL"
- Build may have failed
- Check EAS build status
- Verify `EXPO_TOKEN` is set correctly

### "Could not find .app file"
- Build artifact format may have changed
- Check downloaded file type
- EAS simulator builds are typically .tar.gz

### Tests Timeout
- Increase timeout in workflow: `timeout-minutes: 45`
- Add more `waitForAnimationToEnd` in tests
- CI can be slower than local

## Manual Testing

To test the workflow locally (simulating CI):

```bash
# 1. Boot simulator
xcrun simctl boot "iPhone 15 Pro"

# 2. Build app
cd mobile
eas build --profile development --platform ios --wait

# 3. Get build URL
eas build:list --platform ios --limit 1 --json

# 4. Download and install
curl -L -o app.tar.gz "<BUILD_URL>"
tar -xzf app.tar.gz
xcrun simctl install <SIM_UDID> <APP_PATH>

# 5. Run tests
maestro test .maestro/ --device "iPhone 15 Pro"
```

## Next Steps

1. ✅ Workflow is ready
2. ✅ `EXPO_TOKEN` secret already exists (used by `build-mobile-ios.yml`)
3. Push to trigger workflow
4. Check Actions tab for results

## Artifacts

After each run, you'll get:
- `maestro-results-ios` - Test logs and reports
- `maestro-screenshots-ios` - Screenshots on failure

Download from: Actions → Workflow run → Artifacts
