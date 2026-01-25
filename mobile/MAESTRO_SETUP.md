# Maestro E2E Testing Setup

Maestro is now set up for end-to-end testing of the Smart Pantry mobile app.

## Quick Start

1. **Maestro is already installed** ✅
   - Located at: `/opt/homebrew/bin/maestro`
   - Verify: `maestro --version`

2. **Start your app FIRST (required!):**
   ```bash
   # Option 1: iOS Simulator (recommended for testing)
   npm run ios
   # Wait for app to fully load before running tests
   
   # Option 2: Android Emulator
   npm run android
   
   # Option 3: Physical device with Expo Go
   npm start
   # Then scan QR code with Expo Go app
   ```

3. **In a separate terminal, run tests:**
   ```bash
   cd mobile
   
   # Run all tests
   npm run test:e2e
   
   # Run specific test
   npm run test:e2e:login
   npm run test:e2e:navigation
   npm run test:e2e:home
   ```

   **Important:** The app must be running before you run Maestro tests!

## Test Files

All test flows are in `.maestro/`:

- `login.yml` - Login flow test
- `register.yml` - Registration flow test
- `navigation.yml` - Tab navigation test
- `home-screen.yml` - Home screen quick actions test
- `inventory-basic.yml` - Basic inventory screen test

## Important Notes

⚠️ **App Bundle ID**: Maestro needs the correct app bundle identifier:
- **Development Build**: Use `com.aasimsyed.smartpantry` (in regular test files)
- **Expo Go**: Use `host.exp.Exponent` (use `-expo-go.yml` test files)

⚠️ **Building for Testing**: For reliable testing, you need a development build:
```bash
# Build development build
eas build --profile development --platform ios

# Install on simulator (iOS)
# Download from EAS and drag to simulator, or use Xcode

# Then run tests
npm run test:e2e:home
```

**OR** use Expo Go (less reliable):
```bash
# Start Expo Go
npm start
# Scan QR code with Expo Go app

# Run Expo Go tests
npm run test:e2e:home:expo-go
```

⚠️ **Test Credentials**: The login test uses placeholder credentials (`test@example.com`). You'll need to:
1. Create a test user in your backend, OR
2. Update the test files with real credentials, OR
3. Use environment variables for test credentials

⚠️ **App State**: Some tests assume you're logged in. If tests fail, try:
- Logging in manually first
- Running tests in order (login → navigation → home)
- Adjusting test flows to handle logged-out state

## Improving Test Reliability

For more reliable tests, consider adding `testID` props to key components:

```tsx
// Example: LoginScreen.tsx
<Button 
  testID="login-button"
  mode="contained"
  onPress={handleLogin}
>
  Sign In
</Button>

<TextInput
  testID="email-input"
  label="Email"
  value={email}
  onChangeText={setEmail}
/>
```

Then update Maestro tests to use test IDs:
```yaml
- tapOn: {id: "login-button"}
- tapOn: {id: "email-input"}
```

## Next Steps

1. **Run a test** to verify setup:
   ```bash
   npm run test:e2e:home
   ```

2. **Customize tests** for your specific app flows

3. **Add more tests** as you develop new features

4. **Integrate with CI/CD** (see `.maestro/README.md` for details)

## Documentation

- Full documentation: `.maestro/README.md`
- Maestro docs: https://maestro.mobile.dev/
- Expo E2E guide: https://docs.expo.dev/build-reference/e2e-tests/
