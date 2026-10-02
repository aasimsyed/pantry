/**
 * Subscriptions via RevenueCat.
 *
 * The backend decides the user's tier (including grandfathered paid-app buyers),
 * so this module only identifies the purchaser, shows the paywall and refreshes
 * the server's cached status after a purchase.
 */

import { Alert, Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import apiClient from '../api/client';

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

export const purchasesAvailable = Platform.OS === 'ios' && !!IOS_API_KEY;

let configured = false;

function ensureConfigured(): boolean {
  if (!purchasesAvailable) return false;
  if (!configured) {
    Purchases.configure({ apiKey: IOS_API_KEY as string });
    configured = true;
  }
  return true;
}

/** Ties purchases to the account and uploads the receipt used to grandfather paid-app buyers. */
export async function identifyPurchaser(userId: number): Promise<void> {
  if (!ensureConfigured()) return;
  try {
    const { customerInfo } = await Purchases.logIn(String(userId));
    if (!customerInfo.originalApplicationVersion) {
      await Purchases.syncPurchases();
      await apiClient.getAiUsage(true);
    }
  } catch (err) {
    console.warn('RevenueCat identify failed:', err);
  }
}

export async function resetPurchaser(): Promise<void> {
  if (!configured) return;
  try {
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch (err) {
    console.warn('RevenueCat logout failed:', err);
  }
}

const PREMIUM_UNAVAILABLE = "Premium isn't available right now. Please try again later.";

/** Presents the RevenueCat paywall. Resolves true when the user purchased or restored. */
export async function presentPaywall(): Promise<boolean> {
  if (!ensureConfigured()) return false;
  // An offering without App Store products renders as a blank sheet
  const { current } = await Purchases.getOfferings().catch(() => ({ current: null }));
  if (!current?.availablePackages.length) throw new Error(PREMIUM_UNAVAILABLE);
  const result = await RevenueCatUI.presentPaywall();
  const unlocked = result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
  if (unlocked) await apiClient.getAiUsage(true);
  return unlocked;
}

export async function restorePurchases(): Promise<void> {
  if (!ensureConfigured()) return;
  await Purchases.restorePurchases();
  await apiClient.getAiUsage(true);
}

/** Whether there is a live App Store subscription to manage; grandfathered buyers have none. */
export async function hasActiveSubscription(): Promise<boolean> {
  if (!ensureConfigured()) return false;
  try {
    const { activeSubscriptions } = await Purchases.getCustomerInfo();
    return activeSubscriptions.length > 0;
  } catch {
    return false;
  }
}

export async function manageSubscription(): Promise<void> {
  if (!ensureConfigured()) return;
  await Purchases.showManageSubscriptions();
}

/** Explains the free limit and offers the paywall. */
export function offerPremium(message: string): void {
  if (!purchasesAvailable) {
    Alert.alert('Daily limit reached', message);
    return;
  }
  Alert.alert('Daily limit reached', message, [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'See Premium',
      onPress: () => presentPaywall().catch((err) => Alert.alert('Premium', err.message)),
    },
  ]);
}
