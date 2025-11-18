# Quick Deploy Guide - Android (100% Free)

Follow these steps to deploy your app for free on Android:

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 2: Login to Expo

```bash
eas login
```

If you don't have an account, create one at https://expo.dev (free).

## Step 3: Configure EAS

```bash
cd mobile
eas build:configure
```

This will:
- Create an `eas.json` file
- Link your project to Expo
- Set up build profiles

## Step 4: Update App Configuration

Edit `app.json`:
1. Change `bundleIdentifier` (iOS) and `package` (Android) to your unique identifier
   - Example: `com.yourname.smartpantry`
2. Update `name` to your app's display name
3. The `projectId` will be auto-generated when you run `eas build:configure`

## Step 5: Build Android APK (Free)

```bash
# Build a preview APK (for testing/distribution)
eas build --platform android --profile preview
```

This will:
- Build your app in the cloud (free)
- Generate an APK file
- Provide a download link

**Build time**: ~10-15 minutes

## Step 6: Distribute Your App

### Option A: Direct APK Distribution (100% Free)

1. Download the APK from the EAS dashboard
2. Share via:
   - Email
   - Google Drive / Dropbox
   - Your website
   - QR code

Users need to:
- Enable "Install from Unknown Sources" on Android
- Download and install the APK

### Option B: Google Play Internal Testing (Free)

1. Create a Google Play Developer account (one-time $25 fee)
2. Upload APK to Google Play Console
3. Use "Internal Testing" track (free, up to 100 testers)
4. Share test link with users

### Option C: Firebase App Distribution (Free)

1. Create Firebase project (free)
2. Install Firebase CLI: `npm install -g firebase-tools`
3. Upload APK to Firebase App Distribution
4. Share invite links with testers

## Step 7: Update Production API URL

Before building for production:

1. Deploy your FastAPI backend (free options):
   - **Railway**: https://railway.app (free tier)
   - **Render**: https://render.com (free tier)
   - **Fly.io**: https://fly.io (free tier)

2. Update API URL in `src/api/client.ts`:
   ```typescript
   // Replace 'https://your-production-api.com' with your deployed URL
   return process.env.EXPO_PUBLIC_API_URL || 'https://your-app.railway.app';
   ```

3. Or set via EAS Secrets:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://your-api.com
   ```

## Step 8: Build Production Version

```bash
# Build production Android App Bundle (for Play Store)
eas build --platform android --profile production
```

## iOS Deployment (Requires $99/year Apple Developer)

If you want to deploy to iOS:

1. **Get Apple Developer Account**: $99/year
2. **Build iOS**:
   ```bash
   eas build --platform ios
   ```
3. **Submit to App Store**:
   ```bash
   eas submit --platform ios
   ```

**Free Alternative**: Use TestFlight for beta testing (included with Apple Developer account)

## Troubleshooting

### Build Fails
- Check `app.json` configuration
- Ensure all dependencies are in `package.json`
- Check EAS build logs for errors

### API Not Working in Production
- Verify backend is deployed and accessible
- Check CORS settings on backend
- Update API URL in production build

### App Crashes on Launch
- Test in development first
- Check device logs: `adb logcat` (Android) or Xcode console (iOS)
- Verify all native dependencies are compatible

## Next Steps

- Set up **Over-the-Air (OTA) updates** for instant bug fixes
- Configure **analytics** (Firebase, Sentry - both have free tiers)
- Set up **crash reporting** (Sentry free tier)

## Resources

- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [EAS Submit Docs](https://docs.expo.dev/submit/introduction/)
- [Expo Deployment Guide](https://docs.expo.dev/distribution/introduction/)

