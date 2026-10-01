/**
 * Android capabilities for Smart Pantry (Expo / React Native).
 * Use with a built app on emulator: build with `cd mobile && npx expo run:android`.
 * Optionally set APP_PATH_ANDROID to point to .apk for fresh install.
 */
const path = process.env.APP_PATH_ANDROID;

export const androidCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'emulator-5554',
  'appium:appPackage': 'com.aasimsyed.smartpantry',
  'appium:appActivity': process.env.ANDROID_APP_ACTIVITY || '.MainActivity',
  ...(path && { 'appium:app': path }),
};
