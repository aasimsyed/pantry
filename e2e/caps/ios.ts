/**
 * iOS capabilities for Smart Pantry (Expo / React Native).
 * Use with a built app on simulator: build with `cd mobile && npx expo run:ios`.
 * Optionally set APP_PATH to point to .app bundle for fresh install.
 */
const path = process.env.APP_PATH_IOS;

export const iosCapabilities = {
  platformName: 'iOS',
  'appium:automationName': 'XCUITest',
  'appium:deviceName': process.env.IOS_DEVICE_NAME || 'iPhone 16',
  'appium:platformVersion': process.env.IOS_PLATFORM_VERSION || '26.2',
  // Attach to already-installed app (after expo run:ios)
  'appium:bundleId': 'com.aasimsyed.smartpantry',
  ...(path && { 'appium:app': path }),
};
