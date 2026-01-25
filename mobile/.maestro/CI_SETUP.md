# Maestro CI/CD Setup Guide

## 💰 Cost: FREE (Self-Hosted Option)

**The cheapest option is FREE:** Use GitHub Actions with self-hosted simulators/emulators. This is completely free within GitHub's free tier (2,000 minutes/month for private repos, unlimited for public repos).

Maestro Cloud costs **$250/device/month** - only use if you need managed infrastructure.

## Headless Mode & CI Overview

Maestro **does run headlessly** in CI environments. You don't need a visible simulator/emulator window - Maestro can control them programmatically.

## Two Approaches for CI

### Option 1: Self-Hosted CI (FREE - Recommended) ✅

**Pros:**
- ✅ **100% FREE** (within GitHub Actions limits)
- Full control over environment
- No external dependencies
- Works with GitHub Actions free tier

**Cons:**
- Requires simulator/emulator setup
- Sequential execution (unless parallelized)
- More configuration needed

**This is the cheapest option - completely free!**

### Option 2: Maestro Cloud (Paid)

**Pros:**
- No simulator/emulator setup needed
- Managed infrastructure
- Parallel test execution
- Rich reporting

**Cons:**
- ❌ **$250/device/month** (not free)
- Requires Maestro Cloud account
- Tests run on their infrastructure

**Setup:**
1. Sign up at https://cloud.mobile.dev
2. Get your API key
3. Add to GitHub Secrets: `MAESTRO_CLOUD_API_KEY`
4. Use the `mobile-dev-inc/action-maestro-cloud` action

### Option 2: Self-Hosted CI (GitHub Actions with Simulators)

**Pros:**
- Full control
- No external dependencies
- Free (within GitHub Actions limits)

**Cons:**
- Requires simulator/emulator setup
- More complex configuration
- Slower (sequential execution)

## GitHub Actions Setup (Self-Hosted)

### iOS Simulator Setup

```yaml
name: Maestro E2E Tests

on:
  pull_request:
    paths:
      - 'mobile/**'
  push:
    branches: [main]
    paths:
      - 'mobile/**'

jobs:
  test-ios:
    runs-on: macos-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: mobile/package-lock.json

      - name: Install dependencies
        working-directory: ./mobile
        run: npm ci

      - name: Install Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          export PATH="$PATH:$HOME/.maestro/bin"
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: Start iOS Simulator
        run: |
          xcrun simctl boot "iPhone 15 Pro" || true
          xcrun simctl bootstatus "iPhone 15 Pro"

      - name: Build and Install App
        working-directory: ./mobile
        run: |
          # Build development build
          eas build --profile development --platform ios --non-interactive
          # Download and install (you'll need to implement this)
          # Or use a pre-built app from artifacts

      - name: Run Maestro Tests
        working-directory: ./mobile
        run: |
          maestro test .maestro/ --device "iPhone 15 Pro"

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: maestro-results
          path: mobile/.maestro/tests/
```

### Android Emulator Setup

```yaml
  test-android:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: mobile/package-lock.json

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Create Android Emulator
        run: |
          echo "y" | sdkmanager "system-images;android-33;google_apis;x86_64"
          echo "no" | avdmanager create avd -n test_emulator -k "system-images;android-33;google_apis;x86_64"

      - name: Start Android Emulator
        run: |
          emulator -avd test_emulator -no-window -no-audio -no-boot-anim &
          adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed | tr -d '\r') ]]; do sleep 1; done'

      - name: Install Maestro
        run: |
          curl -Ls "https://get.maestro.mobile.dev" | bash
          export PATH="$PATH:$HOME/.maestro/bin"
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: Build and Install App
        working-directory: ./mobile
        run: |
          # Build APK
          eas build --profile development --platform android --non-interactive
          # Install via adb
          # adb install path/to/app.apk

      - name: Run Maestro Tests
        working-directory: ./mobile
        run: |
          maestro test .maestro/ --device "test_emulator"

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: maestro-results-android
          path: mobile/.maestro/tests/
```

## Maestro Cloud Setup (Paid - $250/month)

⚠️ **Note:** Maestro Cloud costs $250/device/month. For a free solution, use the self-hosted approach above.

If you still want to use Maestro Cloud:

```yaml
name: Maestro E2E Tests (Cloud - Paid)

on:
  pull_request:
    paths:
      - 'mobile/**'
  push:
    branches: [main]
    paths:
      - 'mobile/**'

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build App
        working-directory: ./mobile
        run: |
          npm ci
          eas build --profile development --platform ios --non-interactive

      - name: Run Maestro Tests on Cloud
        uses: mobile-dev-inc/action-maestro-cloud@v1
        with:
          api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
          app-file: path/to/your/app.ipa  # or .apk for Android
          flows: .maestro/
```

## Headless Mode Details

**Maestro automatically runs headlessly when:**
- No display is available (CI environments)
- Simulators/emulators are started with `-no-window` flags
- Running in GitHub Actions (macOS runners have virtual display)

**Key Points:**
- ✅ **No visible simulator needed** - Maestro controls it programmatically
- ✅ **Works in CI** - GitHub Actions, CircleCI, etc.
- ✅ **Faster execution** - No rendering overhead
- ⚠️ **Still needs simulator/emulator** - Just not visible

## Local vs CI Differences

| Aspect | Local Development | CI/CD |
|--------|------------------|-------|
| Simulator visible | ✅ Yes (optional) | ❌ No (headless) |
| Manual interaction | ✅ Possible | ❌ Not possible |
| Setup complexity | Low | Medium-High |
| Execution speed | Normal | Faster (headless) |
| Debugging | Easy (see screen) | Harder (logs only) |

## Cost Comparison

| Option | Cost | Setup Complexity | Best For |
|--------|------|------------------|----------|
| **Self-Hosted (GitHub Actions)** | ✅ **FREE** | Medium | Most projects |
| Maestro Cloud | ❌ $250/month | Low | Enterprise/High volume |

**Recommendation:** Use the **free self-hosted option** with GitHub Actions. It's completely free within GitHub's free tier limits (2,000 minutes/month for private repos, unlimited for public).

## Best Practices for CI

1. **Use testIDs** (already done ✅) - More reliable than text matching
2. **Add explicit waits** - CI can be slower than local
3. **Handle flakiness** - Use `runFlow` with `when` conditions
4. **Upload artifacts** - Screenshots and logs on failure
5. **Cache dependencies** - Speed up builds
6. **Run on PRs** - Catch issues early
7. **Use GitHub Actions free tier** - 2,000 minutes/month for private repos

## Troubleshooting CI Issues

1. **"Unable to launch app"**
   - Verify app is installed: `xcrun simctl listapps booted` (iOS)
   - Check bundle ID matches: `com.aasimsyed.smartpantry`
   - Ensure simulator is booted: `xcrun simctl boot "iPhone 15 Pro"`

2. **"Element not found"**
   - CI may be slower - increase timeouts
   - Add more `waitForAnimationToEnd` steps
   - Verify testIDs are correct

3. **Simulator not starting**
   - Use `xcrun simctl bootstatus` to check status
   - Add retries for simulator boot
   - Check available devices: `xcrun simctl list devices`

## Example: Complete GitHub Actions Workflow

See `.github/workflows/maestro-tests.yml` for a complete example.
