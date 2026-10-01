import type { Options } from '@wdio/types';
import { iosCapabilities } from './caps/ios';
import { androidCapabilities } from './caps/android';

const platform = (process.env.PLATFORM || 'iOS').toLowerCase();
const capabilities = platform === 'android' ? [androidCapabilities] : [iosCapabilities];

export const config: Options.Testrunner = {
  runner: 'local',
  port: 4723,
  path: '/',
  specs: ['./specs/**/*.e2e.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities,
  logLevel: 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  // Skip starting Appium if you run it yourself: RUN_APPIUM_EXTERNAL=1 npm run e2e:smoke
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
    timeout: 60000,
  },
};
