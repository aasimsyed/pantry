import * as Sentry from '@sentry/react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// Crash reporting (Sentry) — free tier: 5k events/month. Set EXPO_PUBLIC_SENTRY_DSN in .env to enable.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
if (dsn && dsn.length > 0) {
  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    // Reduce noise in development; set to 1.0 in production if you want full traces
    tracesSampleRate: __DEV__ ? 0 : 0.2,
    debug: __DEV__,
  });
}

const Root = Sentry.wrap(App);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
