# Troubleshooting Metro Bundler Errors

## Common Error: "Unable to resolve module empty-module.js"

This error typically occurs when Metro bundler cache is corrupted or node_modules are out of sync.

## Quick Fix (Try These in Order)

### 1. Clear Metro Cache (Fastest)
```bash
cd mobile
npm run start:clear
# or
npx expo start --clear
```

### 2. Reset Everything (Most Reliable)
```bash
cd mobile
npm run reset
# This will:
# - Remove node_modules
# - Remove .expo cache
# - Reinstall dependencies
# Then start fresh:
npm start
```

### 3. Full Clean Install
```bash
cd mobile
npm run clean
# This will:
# - Remove node_modules
# - Reinstall dependencies
# - Clear Metro cache
# - Start the app
```

### 4. Manual Steps (If scripts don't work)
```bash
cd mobile

# Stop any running Metro bundler (Ctrl+C)

# Remove caches
rm -rf node_modules
rm -rf .expo
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*

# Reinstall dependencies
npm install

# Start with cleared cache
npx expo start --clear
```

## Other Common Issues

### "Module not found" errors
- Clear cache: `npm run start:clear`
- Reinstall: `npm run reset`

### App won't load in Expo Go

**Error: "Could not connect to the server" or "Unknown error"**

This usually means:
1. **Metro bundler is not running** - Start it first:
   ```bash
   cd mobile
   npm start
   ```

2. **Simulator can't reach Metro bundler** - For iOS Simulator, use localhost:
   ```bash
   # Start Metro bundler
   npm start
   # Then in Expo Go, manually enter: exp://localhost:8081
   # Or press 'i' in the terminal to open in simulator
   ```

3. **Network IP issues** - If using network IP (192.168.x.x):
   - Make sure your Mac's firewall allows connections
   - Try using `localhost` instead for simulator
   - For physical device, use your Mac's IP address

4. **Clear Expo cache**:
   ```bash
   rm -rf .expo && npm start
   ```

5. **Restart everything**:
   ```bash
   # Stop Metro bundler (Ctrl+C)
   # Close Expo Go app
   # Restart Metro bundler
   npm start
   # Reopen Expo Go and scan QR code or enter URL
   ```

### Build errors
- Clear watchman: `watchman watch-del-all` (if installed)
- Reset Metro: `npm run reset`

## Prevention

Always use `--clear` flag when:
- After updating dependencies
- After pulling new code
- When seeing strange module resolution errors
- After switching branches

## Still Having Issues?

1. Check Node.js version: `node --version` (should be 18+)
2. Check npm version: `npm --version`
3. Try deleting `package-lock.json` and reinstalling:
   ```bash
   rm package-lock.json
   npm install
   ```
