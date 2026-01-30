import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** Message to show when user tries a critical action while offline */
export const OFFLINE_ACTION_MESSAGE =
  "You're offline. Please check your connection and try again.";

/**
 * Hook to track online/offline status using NetInfo (proactive) and API client (reactive).
 * Use isOnline before critical actions (save, delete) and show OFFLINE_ACTION_MESSAGE if false.
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const applyState = (connected: boolean) => {
      setIsOnline((prev) => {
        if (!connected && prev) setWasOffline(true);
        if (connected) setWasOffline(false);
        return connected;
      });
    };

    // Proactive: NetInfo (know we're offline before any request)
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be null (unknown); treat as online unless explicitly false
      const connected =
        state.isConnected === true &&
        (state.isInternetReachable === true || state.isInternetReachable === null);
      applyState(connected);
    });

    NetInfo.fetch().then((state) => {
      const connected =
        state.isConnected === true &&
        (state.isInternetReachable === true || state.isInternetReachable === null);
      applyState(connected);
    });

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
