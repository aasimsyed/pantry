import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';

/** Short vibration (ms) used when expo-haptics is unavailable or fails. */
const FALLBACK_VIBRATE_MS = 15;

/**
 * Triggers a short system vibration. Used as fallback when expo-haptics fails
 * (e.g. simulator, or device where haptics are not supported).
 */
function vibrateFallback(): void {
  try {
    Vibration.vibrate(FALLBACK_VIBRATE_MS);
  } catch {
    // Ignore
  }
}

/**
 * Light impact haptic for key actions (save, delete, add, image selected).
 * Awaits the native call; on failure falls back to a short vibration so the user always feels feedback.
 * Safe to call without await (fire-and-forget).
 */
export async function triggerHapticLight(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    vibrateFallback();
  }
}

/**
 * Success haptic for completion (e.g. barcode scanned, item added, image processed).
 * Awaits the native call; on failure falls back to a short vibration.
 */
export async function triggerHapticSuccess(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    vibrateFallback();
  }
}
