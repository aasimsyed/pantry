# Expo Go Connection Issues

## Error: "Could not connect to the server"

This error means Expo Go can't reach the Metro bundler.

## Quick Fix

### Step 1: Start Metro Bundler
```bash
cd mobile
npm start
```

Wait for the QR code and Metro bundler to start.

### Step 2: Connect Simulator

**For iOS Simulator:**
- Press `i` in the terminal where Metro is running
- OR manually enter in Expo Go: `exp://localhost:8081`

**For Android Emulator:**
- Press `a` in the terminal where Metro is running
- OR manually enter in Expo Go: `exp://10.0.2.2:8081`

**For Physical Device:**
- Scan the QR code shown in terminal
- OR manually enter: `exp://YOUR_MAC_IP:8081` (e.g., `exp://192.168.1.141:8081`)

## Common Issues

### 1. Metro Bundler Not Running
**Symptom:** Error shows a URL but Metro isn't running
**Fix:**
```bash
cd mobile
npm start
```

### 2. Wrong URL Format
**Symptom:** Using network IP in simulator
**Fix:** 
- iOS Simulator: Use `exp://localhost:8081`
- Physical Device: Use `exp://YOUR_MAC_IP:8081`

### 3. Firewall Blocking
**Symptom:** Works on simulator but not physical device
**Fix:**
- Check Mac firewall settings
- Allow incoming connections for Node.js
- Or temporarily disable firewall to test

### 4. Port Already in Use
**Symptom:** "Port 8081 is already in use"
**Fix:**
```bash
# Find and kill process on port 8081
lsof -ti:8081 | xargs kill -9
# Then start Metro
npm start
```

### 5. Cache Issues
**Symptom:** Connection works but app won't load
**Fix:**
```bash
npm run start:clear
```

## Testing with Maestro

Before running Maestro tests:
1. **Start Metro bundler:**
   ```bash
   cd mobile
   npm start
   ```

2. **Wait for app to load in Expo Go:**
   - You should see the login screen or home screen
   - If you see connection errors, fix them first

3. **Then run tests:**
   ```bash
   npm run test:e2e:expo
   ```

## Verification

To check if Metro is running:
```bash
lsof -ti:8081 && echo "Metro is running" || echo "Metro is NOT running"
```

To check your Mac's IP (for physical device):
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```
