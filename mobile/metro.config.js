// Sentry uses this to assign Debug IDs to bundles for source map uploads.
// When @sentry/react-native is installed, use getSentryExpoConfig; otherwise Expo default.
const { getDefaultConfig } = require('expo/metro-config');

try {
  const { getSentryExpoConfig } = require('@sentry/react-native/metro');
  module.exports = getSentryExpoConfig(__dirname);
} catch {
  module.exports = getDefaultConfig(__dirname);
}
