# Free Deployment Guide for Smart Pantry Mobile App

This guide covers **completely free** options to deploy your Expo React Native app.

## 🆓 Free Deployment Options

### Option 1: EAS Build + App Stores (Recommended - 100% Free)

**Expo Application Services (EAS)** offers a generous free tier:
- ✅ **Unlimited builds** (with some rate limits)
- ✅ **Free app store submissions**
- ✅ **Over-the-air (OTA) updates**
- ✅ **Build for both iOS and Android**

#### Setup Steps:

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo:**
   ```bash
   eas login
   ```
   (Create a free account at https://expo.dev if you don't have one)

3. **Configure EAS:**
   ```bash
   eas build:configure
   ```
   This creates an `eas.json` file with build configurations.

4. **Build for iOS (requires Apple Developer account - $99/year):**
   ```bash
   eas build --platform ios
   ```
   ⚠️ **Note**: iOS builds require an Apple Developer account ($99/year). However, you can:
   - Use **TestFlight** (free with Apple Developer account) for beta testing
   - Build for **Android only** (completely free)

5. **Build for Android (100% Free):**
   ```bash
   eas build --platform android
   ```
   This will create an APK or AAB file you can distribute.

6. **Submit to App Stores (Free):**
   ```bash
   # iOS (requires Apple Developer account)
   eas submit --platform ios
   
   # Android (completely free)
   eas submit --platform android
   ```

#### Android Distribution (Free Options):

**Option A: Google Play Store (Free)**
- One-time $25 registration fee (but you can use Google Play Internal Testing for free)
- Upload APK/AAB to Google Play Console
- Use "Internal Testing" track (free, up to 100 testers)

**Option B: Direct APK Distribution (100% Free)**
- Download the APK from EAS build
- Share via email, cloud storage, or website
- Users enable "Install from Unknown Sources" on Android

**Option C: Firebase App Distribution (Free)**
- Free tier: Up to 10 apps, unlimited testers
- Easy distribution via email links
- No app store required

### Option 2: Expo Go (Free - Development/Testing Only)

**Expo Go** is free but limited:
- ✅ Free for development and testing
- ❌ Cannot use custom native code
- ❌ Not suitable for production
- ✅ Great for sharing with testers during development

**Usage:**
```bash
expo start
# Share QR code with testers
```

### Option 3: Local Builds (Free but Complex)

Build locally using:
- **iOS**: Xcode (Mac only, requires Apple Developer account)
- **Android**: Android Studio (free, no account needed)

```bash
# Generate native projects
npx expo prebuild

# Build with Xcode/Android Studio
```

## 📋 Pre-Deployment Checklist

### 1. Update App Configuration

Update `app.json` with:
- ✅ App name
- ✅ Bundle identifier (iOS) / Package name (Android)
- ✅ App icon and splash screen
- ✅ Version number
- ✅ Production API URL

### 2. Configure Production API

Update `src/api/client.ts` to use your production API URL:
```typescript
const getApiBaseUrl = () => {
  if (!__DEV__) {
    return 'https://your-production-api.com';  // Your deployed backend
  }
  return 'http://192.168.69.61:8000';
};
```

### 3. Environment Variables

For production, use environment variables:
```bash
# Install expo-constants
npm install expo-constants

# Use Constants.expoConfig.extra.apiUrl in your code
```

### 4. Test Production Build

Before deploying:
```bash
# Test Android build locally
eas build --platform android --profile preview

# Install on device and test thoroughly
```

## 🚀 Quick Start: Deploy Android (Free)

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Login:**
   ```bash
   eas login
   ```

3. **Configure:**
   ```bash
   cd mobile
   eas build:configure
   ```

4. **Build Android APK:**
   ```bash
   eas build --platform android --profile preview
   ```

5. **Download and Share:**
   - Download APK from EAS dashboard
   - Share with users via email/cloud storage
   - Or upload to Google Play Internal Testing (free)

## 📱 iOS Deployment (Requires Apple Developer Account)

**Cost**: $99/year for Apple Developer Program

**Free Alternatives:**
1. **TestFlight** (included with Apple Developer account)
   - Beta testing for up to 10,000 testers
   - Free with Apple Developer account

2. **Ad Hoc Distribution** (included with Apple Developer account)
   - Distribute to up to 100 devices
   - No App Store required

## 🔄 Over-the-Air (OTA) Updates (Free)

Update your app without rebuilding:

```bash
# Publish update
eas update --branch production --message "Bug fixes"

# Users get update automatically (if using EAS Update)
```

## 📊 Cost Summary

| Service | Cost | Notes |
|---------|------|-------|
| EAS Build | **Free** | Unlimited builds (with rate limits) |
| EAS Submit | **Free** | App store submissions |
| Android APK | **Free** | Direct distribution |
| Google Play | **Free** | Internal Testing track |
| iOS Build | **Free** | But requires $99/year Apple Developer |
| TestFlight | **Free** | With Apple Developer account |
| Firebase App Distribution | **Free** | Up to 10 apps |

## 🎯 Recommended Free Deployment Path

1. **Development**: Use Expo Go (free)
2. **Testing**: EAS Build for Android (free) + TestFlight for iOS (with Apple Developer)
3. **Production**: 
   - Android: Google Play Internal Testing or direct APK
   - iOS: App Store (requires Apple Developer account)

## 📚 Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Google Play Console](https://play.google.com/console)
- [Apple Developer](https://developer.apple.com)
- [Firebase App Distribution](https://firebase.google.com/products/app-distribution)

## ⚠️ Important Notes

1. **Backend API**: Make sure your FastAPI backend is deployed and accessible
   - Options: Railway, Render, Fly.io (all have free tiers)
   - Update API URL in production builds

2. **API Keys**: Never commit API keys to git
   - Use environment variables
   - Use EAS Secrets for sensitive data

3. **App Store Guidelines**: 
   - Follow platform-specific guidelines
   - Test thoroughly before submission

4. **Rate Limits**: EAS free tier has rate limits but is generous for most use cases

