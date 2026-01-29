/**
 * On-device OCR using ML Kit Text Recognition.
 * Returns extracted text or null if unavailable/failed (e.g. Expo Go, no native module).
 * Use-cloud-OCR preference stored in AsyncStorage (default: false = use ML Kit first).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const MIN_TEXT_LENGTH = 15;
const USE_CLOUD_OCR_KEY = 'useCloudOcr';

export async function recognizeTextFromUri(uri: string): Promise<string | null> {
  try {
    const TextRecognition = require('@react-native-ml-kit/text-recognition').default;
    const result = await TextRecognition.recognize(uri);
    const text = result?.text?.trim() ?? '';
    return text.length >= MIN_TEXT_LENGTH ? text : null;
  } catch {
    return null;
  }
}

export const MIN_OCR_TEXT_LENGTH = MIN_TEXT_LENGTH;

export async function getUseCloudOcr(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(USE_CLOUD_OCR_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function setUseCloudOcr(value: boolean): Promise<void> {
  await AsyncStorage.setItem(USE_CLOUD_OCR_KEY, value ? 'true' : 'false');
}
