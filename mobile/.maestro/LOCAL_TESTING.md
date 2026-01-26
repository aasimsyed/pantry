# Local Maestro Testing Guide

Quick guide for running Maestro E2E tests locally on your machine.

## ✅ Prerequisites Check

Maestro is already installed! ✅
- Version: 2.1.0
- Location: `/opt/homebrew/bin/maestro`

## Quick Start

### Option 1: Using Expo Go (Fastest - Recommended for Quick Testing)

1. **Start your app in Expo Go:**
   ```bash
   cd mobile
   npm start
   # Press 'i' to open iOS Simulator, or scan QR code with Expo Go app
   ```

2. **Wait for app to fully load** (you should see the login screen or home screen)

3. **In a separate terminal, run tests:**
   ```bash
   cd mobile
   
   # Run all tests
   npm run test:e2e
   
   # Or run a specific test
   npm run test:e2e:login
   npm run test:e2e:recipes
   npm run test:e2e:inventory-advanced
   ```

**Note:** For Expo Go, tests will use the `host.exp.Exponent` app ID automatically.

### Option 2: Using Development Build (Most Reliable)

1. **Build a development build:**
   ```bash
   cd mobile
   eas build --profile development --platform ios
   ```
   ⏱️ This takes ~10-20 minutes

2. **Install on simulator:**
   - Download the build from EAS dashboard
   - Drag the `.app` file to your iOS Simulator, OR
   - Use Xcode to install: `xcrun simctl install booted path/to/app.app`

3. **Run tests:**
   ```bash
   cd mobile
   npm run test:e2e
   ```

## Available Test Commands

All tests use npm scripts for convenience:

```bash
# Run all tests (both dev build and Expo Go)
npm run test:e2e

# Run all Expo Go tests with a single command! 🎉
npm run test:e2e:expo

# Run all dev build tests
npm run test:e2e:dev

# Individual test files (dev build)
npm run test:e2e:login              # Login flow
npm run test:e2e:register           # Registration flow
npm run test:e2e:navigation         # Tab navigation
npm run test:e2e:home               # Home screen
npm run test:e2e:recipes            # Recipe generation
npm run test:e2e:recipe-box        # Saved recipes
npm run test:e2e:recipe-detail     # Recipe details
npm run test:e2e:inventory         # Basic inventory
npm run test:e2e:inventory-advanced # Advanced inventory (add/edit)
npm run test:e2e:settings          # Settings screen
npm run test:e2e:statistics        # Statistics screen
npm run test:e2e:expiring          # Expiring items

# Expo Go variants (add :expo suffix)
npm run test:e2e:login:expo         # Login (Expo Go)
npm run test:e2e:recipes:expo        # Recipes (Expo Go)
# ... and 10 more Expo Go variants
```

## Running Tests Directly with Maestro

You can also run tests directly with Maestro CLI:

```bash
cd mobile

# Run all tests
maestro test .maestro/

# Run specific test
maestro test .maestro/login.yml

# Run with specific device
maestro test .maestro/ --device "iPhone 15 Pro"
```

## Test Execution Tips

### 1. **App Must Be Running First**
   - Always start your app (`npm start` or `npm run ios`) before running tests
   - Wait for the app to fully load (login screen or home screen visible)

### 2. **Simulator/Emulator Must Be Open**
   - iOS: Open Simulator via Xcode or `open -a Simulator`
   - Android: Start emulator via Android Studio

### 3. **Check Available Devices**
   ```bash
   # List iOS simulators
   xcrun simctl list devices available
   
   # List Android emulators
   adb devices
   ```

### 4. **Run Tests with Specific Device**
   ```bash
   maestro test .maestro/login.yml --device "iPhone 15 Pro"
   ```

## Troubleshooting

### ❌ "Unable to launch app"
**Solution:**
- Make sure the app is installed on the simulator
- For Expo Go: Ensure Expo Go app is running
- For dev build: Verify bundle ID matches `com.aasimsyed.smartpantry`
- Check simulator is booted: `xcrun simctl list devices | grep Booted`

### ❌ "Element not found"
**Solution:**
- Verify app is running and fully loaded
- Check that testIDs match what's in the code
- Wait a moment and try again (app might still be loading)

### ❌ "Device not found"
**Solution:**
- List available devices: `xcrun simctl list devices available`
- Boot a simulator: `xcrun simctl boot "iPhone 15 Pro"`
- Or let Maestro auto-detect (don't specify `--device`)

### ❌ Tests timeout
**Solution:**
- Increase timeout in test file: `timeout: 30000`
- Check network connectivity (if tests need API)
- Ensure backend is running if tests require API calls

### ❌ "App ID mismatch"
**Solution:**
- For Expo Go: Tests should use `host.exp.Exponent` (some test files have `-expo-go.yml` suffix)
- For dev build: Use `com.aasimsyed.smartpantry`
- Check `config.yaml` in `.maestro/` directory

## Test Output

Maestro provides detailed output:
- ✅ Green checkmarks for passed steps
- ❌ Red X for failed steps
- 📸 Screenshots on failures (saved to `.maestro/screenshots/`)

## Viewing Test Results

After running tests, check:
- Terminal output for step-by-step results
- Screenshots folder: `.maestro/screenshots/` (if any failures)
- Maestro logs show detailed execution flow

## Best Practices

1. **Start with one test** - Run `npm run test:e2e:login` first to verify setup
2. **Keep app running** - Don't close the app between test runs
3. **Use testIDs** - All tests use `testID` props for reliable element selection
4. **Check logs** - Maestro shows detailed execution logs
5. **Run tests in order** - Some tests depend on app state (e.g., login first)

## Next Steps

Once local tests pass:
- ✅ Tests are ready for CI/CD
- ✅ GitHub Actions workflow will run these automatically
- ✅ See `.github/workflows/maestro-tests.yml` for CI setup

## Need Help?

- Maestro docs: https://maestro.mobile.dev/
- Test files: Check `.maestro/*.yml` files
- Coverage report: See `COVERAGE.md`
