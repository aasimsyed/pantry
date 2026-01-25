import { useState, useEffect } from 'react';
import apiClient from '../api/client';

/**
 * Hook to track online/offline status and provide user-friendly messaging
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Check initial status
    setIsOnline(apiClient.isCurrentlyOnline());

    // Poll online status periodically (every 5 seconds)
    const interval = setInterval(() => {
      const currentStatus = apiClient.isCurrentlyOnline();
      if (currentStatus !== isOnline) {
        setIsOnline(currentStatus);
        if (!currentStatus) {
          setWasOffline(true);
        } else if (wasOffline) {
          // Just came back online
          setWasOffline(false);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isOnline, wasOffline]);

  return {
    isOnline,
    wasOffline,
    message: isOnline 
      ? (wasOffline ? 'Back online!' : null)
      : 'You are currently offline. Some features may not work.',
  };
}
