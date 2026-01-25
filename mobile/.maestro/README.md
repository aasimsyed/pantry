# Maestro E2E Tests

This directory contains end-to-end tests for the Smart Pantry mobile app using [Maestro](https://maestro.mobile.dev/).

## Prerequisites

1. **Install Maestro CLI:**
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **Verify installation:**
   ```bash
   maestro --version
   ```

## Testing Approaches

### Option 1: Development Build (Recommended)

For reliable testing, build and install a development build on your simulator:

1. **Build a development build:**
   ```bash
   cd mobile
   eas build --profile development --platform ios
   # or for Android
   eas build --profile development --platform android
   ```

2. **Install on simulator:**
   - iOS: Download and install via Xcode or drag to simulator
   - Android: `adb install path/to/app.apk`

3. **Run tests:**
   ```bash
   maestro test .maestro/home-screen.yml
   ```

### Option 2: Expo Go (Quick Testing)

If you're using Expo Go for quick testing:

1. **Start Expo Go:**
   ```bash
   npm start
   # Scan QR code with Expo Go app
   ```

2. **Run tests with Expo Go app ID:**
   ```bash
   maestro test .maestro/home-screen-expo-go.yml
   ```

**Note:** Expo Go tests may be less reliable as the app ID is shared with other Expo apps.

## Running Tests

### Run all tests:
```bash
maestro test .maestro/
```

### Run a specific test:
```bash
maestro test .maestro/login.yml
```

### Run tests with specific device:
```bash
# iOS Simulator
maestro test .maestro/ --device "iPhone 15 Pro"

# Android Emulator
maestro test .maestro/ --device "Pixel 7"
```

### Run tests in cloud (requires Maestro Cloud account):
```bash
maestro cloud --apiKey YOUR_API_KEY
```

## Test Flows

### `login.yml`
Tests the user login flow:
- Verifies login screen elements
- Tests email and password input
- Validates login success/failure

### `register.yml`
Tests the user registration flow:
- Navigates to registration screen
- Fills registration form
- Validates registration result

### `navigation.yml`
Tests navigation between main tabs:
- Verifies tab navigation works
- Tests all main screens (Home, Inventory, Recipes, Recipe Box)

### `home-screen.yml` / `home-screen-expo-go.yml`
Tests the home screen:
- Verifies all quick action cards are visible
- Tests navigation from quick actions
- Validates home screen content

### `inventory-basic.yml`
Tests basic inventory screen functionality:
- Navigates to inventory
- Verifies inventory screen elements
- Checks for empty state or pantry selector

## Writing New Tests

Maestro tests are written in YAML. Key commands:

- `launchApp` - Launch the app
- `tapOn: "Text"` - Tap on element with text
- `inputText: "text"` - Input text into focused field
- `assertVisible: "Text"` - Assert element is visible
- `back` - Go back
- `scroll` - Scroll the screen
- `runFlow` - Conditional flow execution

See [Maestro Documentation](https://maestro.mobile.dev/) for full command reference.

## Tips

1. **Test IDs**: For more reliable tests, consider adding `testID` props to React Native components:
   ```tsx
   <Button testID="login-button">Sign In</Button>
   ```
   Then use: `tapOn: ".*login-button.*"` or `tapOn: {id: "login-button"}`

2. **Wait for elements**: Maestro automatically waits for elements, but you can add explicit waits:
   ```yaml
   - waitForAnimationToEnd
   - assertVisible: "Element"
   ```

3. **Conditional flows**: Use `runFlow` with `when` for handling different app states

4. **Screenshots**: Maestro automatically takes screenshots on failures

## CI/CD Integration

### EAS Workflows
Maestro tests can be integrated into EAS Workflows. See [Expo E2E Testing Docs](https://docs.expo.dev/build-reference/e2e-tests/).

### GitHub Actions
Example workflow:
```yaml
- name: Run Maestro Tests
  run: |
    curl -Ls "https://get.maestro.mobile.dev" | bash
    maestro test .maestro/
```

## Troubleshooting

1. **Tests fail with "Unable to launch app"**:
   - Verify the app is built and installed on the simulator
   - For Expo Go, use `host.exp.Exponent` as appId
   - For development builds, ensure the bundle ID matches `com.aasimsyed.smartpantry`
   - Check that the simulator/emulator is running

2. **Tests fail with "Element not found"**:
   - Verify the app is running
   - Check that text labels match exactly (case-sensitive)
   - Add `testID` props for more reliable element selection

3. **Tests timeout**:
   - Increase timeout in config: `timeout: 30000`
   - Check network connectivity if tests require API calls

4. **Tests pass locally but fail in CI**:
   - Ensure emulator/simulator is properly configured
   - Check that app builds successfully
   - Verify environment variables are set correctly
