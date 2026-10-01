import { useState, useEffect } from 'react';
import { NativeModules } from 'react-native';

/** Message to show when user tries a critical action while offline */
export const OFFLINE_ACTION_MESSAGE =
  "You're offline. Please check your connection and try again.";

/**
 * Hook to track online/offline status using NetInfo (proactive) and API client (reactive).
 * Use isOnline before critical actions (save, delete) and show OFFLINE_ACTION_MESSAGE if false.
 * If the native module is not linked (e.g. build before netinfo was added), we never load netinfo
 * and assume online so the app does not crash.
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!NativeModules.RNCNetInfo) return;

    const NetInfo = require('@react-native-community/netinfo').default;
    if (!NetInfo) return;

    const applyState = (connected: boolean) => {
      setIsOnline((prev) => {
        if (!connected && prev) setWasOffline(true);
        if (connected) setWasOffline(false);
        return connected;
      });
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected =
        state.isConnected === true &&
        (state.isInternetReachable === true || state.isInternetReachable === null);
      applyState(connected);
    });

    NetInfo.fetch()
      .then((state) => {
        const connected =
          state.isConnected === true &&
          (state.isInternetReachable === true || state.isInternetReachable === null);
        applyState(connected);
      })
      .catch(() => {});

    return () => unsubscribe();
  }, []);

  return {
    isOnline,
    wasOffline,
    message: isOnline
      ? (wasOffline ? 'Back online!' : null)
      : 'You are currently offline. Some features may not work.',
  };
}
