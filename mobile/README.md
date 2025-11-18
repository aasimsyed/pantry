# Smart Pantry Mobile App

React Native mobile application for the Smart Pantry system, built with Expo.

## Features

- 📦 **Inventory Management**: View and manage pantry items with mobile-optimized UI
- 📸 **Camera Integration**: Take photos of products to automatically process them
- ⚠️ **Expiration Tracking**: Monitor items expiring soon or expired
- 🍳 **AI Recipe Generation**: Generate recipes based on available ingredients
- 📚 **Recipe Box**: Save and manage favorite recipes
- 📊 **Statistics**: View pantry analytics and insights

## Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (Mac) or Android Emulator
- Or Expo Go app on your physical device

## Setup

1. **Install dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Configure API URL:**
   - For iOS Simulator/Android Emulator: The default `http://localhost:8000` should work
   - For physical device: Update `src/api/client.ts` with your computer's local IP address
     - Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
     - Example: `http://192.168.1.100:8000`

3. **Start the backend API:**
   ```bash
   # From project root
   python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Running the App

### Development

```bash
npm start
```

Then:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app (physical device)

### Build for Production

**For detailed deployment instructions, see:**
- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) - Quick start guide for Android deployment (100% free)
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Comprehensive deployment guide with all free options

**Quick commands:**
```bash
# Build Android APK (free via EAS)
npm run build:android

# Build Android App Bundle for Play Store
npm run build:android:prod

# Build iOS (requires Apple Developer account)
npm run build:ios

# Submit to app stores
npm run submit:android
npm run submit:ios
```

**Prerequisites:**
1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. Configure: `eas build:configure`

## Project Structure

```
mobile/
├── src/
│   ├── api/          # API client
│   ├── components/   # Reusable components
│   ├── navigation/   # Navigation setup
│   ├── screens/      # Screen components
│   ├── types/        # TypeScript types
│   └── utils/        # Utilities and theme
├── App.tsx           # Main app component
└── package.json
```

## Key Technologies

- **Expo**: React Native framework
- **React Navigation**: Navigation library
- **React Native Paper**: Material Design components
- **Axios**: HTTP client
- **Expo Image Picker**: Camera and image selection
- **TypeScript**: Type safety

## Mobile-Specific Features

- **Camera Integration**: Take photos directly from the app
- **Image Picker**: Select images from device gallery
- **Touch-Optimized UI**: Mobile-first design with large touch targets
- **Bottom Tab Navigation**: Easy thumb navigation
- **Pull-to-Refresh**: Native refresh gestures

## Troubleshooting

### API Connection Issues

If you can't connect to the API from a physical device:

1. Make sure your phone and computer are on the same WiFi network
2. Update `API_BASE_URL` in `src/api/client.ts` with your computer's local IP
3. Ensure the FastAPI server is running with `--host 0.0.0.0`
4. Check firewall settings to allow connections on port 8000

### Camera Permissions

The app will request camera and photo library permissions when needed. Make sure to grant them in your device settings if prompted.

## Next Steps

- Add barcode scanning
- Implement push notifications for expiring items
- Add offline support with local caching
- Implement user authentication
- Add sharing features for recipes

