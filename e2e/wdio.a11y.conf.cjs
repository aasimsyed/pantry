/**
 * WDIO config for accessibility (a11y) audits.
 * iOS: uses native performAccessibilityAudit (Xcode 15 / iOS 17+), no license required.
 * Android: runs a11y spec (manual assertions only until we add a free audit path).
 * Run: npm run e2e:a11y (with Appium on 4723 and app installed).
 */
const platform = (process.env.PLATFORM || 'iOS').toLowerCase();
const isAndroid = platform === 'android';

const iosCapabilities = {
  platformName: 'iOS',
  'appium:automationName': 'XCUITest',
  'appium:deviceName': process.env.IOS_DEVICE_NAME || 'iPhone 16',
  'appium:platformVersion': process.env.IOS_PLATFORM_VERSION || '26.2',
  'appium:bundleId': 'com.aasimsyed.smartpantry',
  ...(process.env.APP_PATH_IOS && { 'appium:app': process.env.APP_PATH_IOS }),
  ...(process.env.IOS_UDID && { 'appium:udid': process.env.IOS_UDID }),
  // Launch with larger Dynamic Type so 1.4.4 Resize Text / 1.4.10 Reflow are tested; audit fails if layout doesn't scale
  'appium:processArguments': {
    args: ['-UIPreferredContentSizeCategoryName', 'UICTContentSizeCategoryAccessibilityL'],
  },
};

const androidCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'emulator-5554',
  'appium:appPackage': 'com.aasimsyed.smartpantry',
  'appium:appActivity': process.env.ANDROID_APP_ACTIVITY || '.MainActivity',
  ...(process.env.APP_PATH_ANDROID && { 'appium:app': process.env.APP_PATH_ANDROID }),
};

exports.config = {
  runner: 'local',
  port: 4723,
  path: '/',
  specs: ['./specs/accessibility.e2e.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities: [isAndroid ? androidCapabilities : iosCapabilities],
  logLevel: 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: process.env.RUN_APPIUM_EXTERNAL ? [] : [
    [
      'appium',
      {
        logPath: './e2e-logs/',
        args: {
          address: '127.0.0.1',
          port: 4723,
        },
      },
    ],
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 90000,
  },
};
