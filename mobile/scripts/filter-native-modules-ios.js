/**
 * Outputs Expo autolinking config for iOS with ML Kit excluded.
 * Used when SIMULATOR_BUILD=1 so the app can link for iOS Simulator
 * (MLImage.framework is device-only and would cause linker errors).
 *
 * Run from repo root or mobile/: node mobile/scripts/filter-native-modules-ios.js
 * Podfile runs this from ios/ as: node ../scripts/filter-native-modules-ios.js
 */

const { execFileSync } = require('child_process');
const path = require('path');

const mobileRoot = path.join(__dirname, '..');
const args = ['expo-modules-autolinking', 'react-native-config', '--json', '--platform', 'ios'];
const json = execFileSync('npx', args, { encoding: 'utf8', cwd: mobileRoot });
const config = JSON.parse(json);
delete config.dependencies['@react-native-ml-kit/text-recognition'];
process.stdout.write(JSON.stringify(config));
