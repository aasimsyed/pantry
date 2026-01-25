# Quick Start: Run Tests Locally

## ✅ Setup Complete!

- ✅ Maestro installed (v2.1.0)
- ✅ iPhone 17 Pro simulator is booted
- ✅ npm scripts added to package.json

## 🚀 Run Your First Test (3 Steps)

### Step 1: Start Your App
```bash
cd mobile
npm start
# Press 'i' to open iOS Simulator, or wait for QR code
```

**Wait for the app to fully load** (you should see login screen or home screen)

### Step 2: Run a Test (in a new terminal)
```bash
cd mobile

# Test login flow (recommended first test)
npm run test:e2e:login

# Or test navigation
npm run test:e2e:navigation

# Or run all tests
npm run test:e2e
```

### Step 3: View Results
- ✅ Green checkmarks = passed
- ❌ Red X = failed
- 📸 Screenshots saved on failures

## 📋 All Available Tests

```bash
npm run test:e2e                 # All tests
npm run test:e2e:login           # Login
npm run test:e2e:register        # Registration
npm run test:e2e:navigation      # Tab navigation
npm run test:e2e:home            # Home screen
npm run test:e2e:recipes         # Recipe generation
npm run test:e2e:recipe-box     # Saved recipes
npm run test:e2e:recipe-detail  # Recipe details
npm run test:e2e:inventory      # Basic inventory
npm run test:e2e:inventory-advanced # Advanced inventory
npm run test:e2e:settings       # Settings
npm run test:e2e:statistics     # Statistics
npm run test:e2e:expiring       # Expiring items
```

## 💡 Tips

1. **App must be running** - Always start app first (`npm start`)
2. **Use specific device** - If needed: `maestro test .maestro/login.yml --device "iPhone 17 Pro"`
3. **Check logs** - Maestro shows detailed execution in terminal
4. **Screenshots** - Failures save screenshots to `.maestro/screenshots/`

## 🆘 Troubleshooting

**"Unable to launch app"**
- Make sure app is running in simulator
- Check simulator is booted: `xcrun simctl list devices | grep Booted`

**"Element not found"**
- Wait for app to fully load
- Check app is visible in simulator

**Need more help?**
- See `LOCAL_TESTING.md` for detailed guide
- See `README.md` for full documentation
