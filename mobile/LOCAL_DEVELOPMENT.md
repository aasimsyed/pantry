# Local Mobile App Development & Logging

Guide for running the Smart Pantry mobile app locally and viewing client-side error logs.

## Prerequisites

1. **Node.js** (v18+ recommended)
2. **Expo CLI** (install globally: `npm install -g expo-cli`)
3. **iOS Simulator** (macOS only): Install Xcode from App Store
4. **Android Emulator** (optional): Install Android Studio

## Quick Start

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Start Development Server

```bash
# Start Expo dev server
npm start
# or
expo start
```

This will:
- Start the Metro bundler
- Open Expo DevTools in your browser
- Show a QR code for connecting physical devices

### 3. Run on Device/Simulator

**iOS Simulator (macOS):**
```bash
npm run ios
# or press 'i' in the Expo terminal
```

**Android Emulator:**
```bash
npm run android
# or press 'a' in the Expo terminal
```

**Physical Device:**
- Install "Expo Go" app from App Store / Play Store
- Scan the QR code shown in terminal with your camera (iOS) or Expo Go app (Android)

## Viewing Logs

### Method 1: Terminal Logs (Built-in)

Logs automatically appear in the terminal where you ran `expo start`:

```bash
# All console.log(), console.error(), etc. appear here
npm start
```

**Features:**
- ✅ Shows all JavaScript console logs
- ✅ Shows React Native errors (red screen details)
- ✅ Shows network requests
- ✅ Shows Metro bundler messages

### Method 2: Expo DevTools (Browser)

When you run `expo start`, it automatically opens Expo DevTools in your browser (usually `http://localhost:19002`).

**Features:**
- **Logs tab**: View all console logs in real-time
- **Network tab**: Monitor API requests/responses
- **Device info**: View device details
- **Reload**: Quickly reload the app

### Method 3: React Native Debugger (Advanced)

For more advanced debugging:

1. **Install React Native Debugger:**
   ```bash
   brew install --cask react-native-debugger
   ```

2. **Enable Remote Debugging:**
   - Shake your device/simulator (or press `Cmd+D` on iOS Simulator)
   - Tap "Debug Remote JS"
   - React Native Debugger will open automatically

**Features:**
- ✅ Full Chrome DevTools interface
- ✅ Debugger with breakpoints
- ✅ Network inspector
- ✅ React DevTools integration
- ✅ Redux DevTools (if using Redux)

### Method 4: Device Console Logs

**iOS Simulator:**
```bash
# View iOS simulator logs
xcrun simctl spawn booted log stream --level=debug
```

**iOS Physical Device:**
- Connect device via USB
- Open Xcode → Window → Devices and Simulators
- Select your device → View Device Logs

**Android Emulator:**
```bash
# View Android logs
adb logcat
# Filter for React Native
adb logcat | grep -i react
```

**Android Physical Device:**
```bash
# Connect via USB and enable USB debugging
adb devices
adb logcat | grep -i react
```

### Method 5: Remote Logging (Production-like)

For testing production builds locally:

```bash
# Build development client
eas build --profile development --platform ios

# Install on device, then:
expo start --dev-client
```

## Environment Variables

Set API URL for local development:

**Option 1: Environment Variable (Recommended)**
```bash
# macOS/Linux
export EXPO_PUBLIC_API_URL="http://localhost:8000"
npm start

# Or inline
EXPO_PUBLIC_API_URL="http://localhost:8000" npm start
```

**Option 2: .env File (Not native in Expo, requires expo-env or similar)**

**Option 3: Hardcode for testing** (edit `mobile/src/api/client.ts` temporarily)

**For Physical Device:**
- Use your computer's local IP address instead of `localhost`
- Find your IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
- Example: `export EXPO_PUBLIC_API_URL="http://192.168.1.100:8000"`

## Common Logging Patterns

### In Your Code

```typescript
// Regular logs (show in terminal)
console.log('Debug info:', data);
console.error('Error occurred:', error);

// Grouped logs (better for debugging)
console.group('API Request');
console.log('URL:', url);
console.log('Method:', method);
console.log('Body:', body);
console.groupEnd();

// Conditional logs (only in development)
if (__DEV__) {
  console.log('Dev-only log:', data);
}
```

### Error Handling with Logging

```typescript
try {
  // Your code
} catch (error) {
  console.error('Error details:', {
    message: error.message,
    stack: error.stack,
    context: { /* additional context */ }
  });
  // Show error to user
  Alert.alert('Error', error.message);
}
```

## Troubleshooting

### Logs Not Showing

1. **Check Metro bundler is running**: `npm start`
2. **Clear Metro cache**: `npm start -- --clear`
3. **Restart Expo**: Stop and restart `expo start`
4. **Check device connection**: Ensure device/simulator is connected

### Network Errors

1. **Check API URL**: Verify `EXPO_PUBLIC_API_URL` is correct
2. **For physical device**: Use local IP, not `localhost`
3. **Check CORS**: Ensure backend allows mobile app origin
4. **Check firewall**: Ensure ports are open

### View Detailed Errors

```bash
# Enable verbose logging
EXPO_DEBUG=true npm start

# Or in code
console.error('Full error:', JSON.stringify(error, null, 2));
```

## Recommended Workflow

1. **Start backend** (if testing locally):
   ```bash
   # In another terminal
   cd /path/to/pantry
   python3 start.py
   ```

2. **Start mobile app**:
   ```bash
   cd mobile
   EXPO_PUBLIC_API_URL="http://localhost:8000" npm start
   ```

3. **Open iOS Simulator**:
   ```bash
   npm run ios
   ```

4. **View logs**: Check terminal output or Expo DevTools

5. **Debug**: Use React Native Debugger if needed

## Tips

- **Filter logs**: In terminal, use `| grep "Error"` to filter
- **Save logs**: Redirect to file: `npm start > logs.txt 2>&1`
- **React DevTools**: Install Chrome extension for component inspection
- **Network debugging**: Use Expo DevTools Network tab or React Native Debugger
