import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import apiClient from '../api/client';
import type { User, LoginRequest, RegisterRequest } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  needsRecoveryQuestions: boolean;
  completeRecoveryQuestions: () => void;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Try to sign in using stored tokens after biometric. Returns true if user is now logged in. */
  tryBiometricLogin: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsRecoveryQuestions, setNeedsRecoveryQuestions] = useState(false);

  useEffect(() => {
    // Check if user is logged in on mount
    checkAuth();
    
    // Register callback for authentication failures
    apiClient.setOnAuthFailure(() => {
      setUser(null);
      // Show user-friendly message on next tick to avoid render conflicts
      setTimeout(() => {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please sign in again to continue.',
          [{ text: 'OK', style: 'default' }]
        );
      }, 100);
    });
  }, []);

  const checkRecoveryQuestions = async () => {
    try {
      const data = await apiClient.getRecoveryQuestions();
      setNeedsRecoveryQuestions(data.user_question_ids.length < 2);
    } catch {
      setNeedsRecoveryQuestions(false);
    }
  };

  const completeRecoveryQuestions = () => {
    setNeedsRecoveryQuestions(false);
  };

  const checkAuth = async () => {
    try {
      await apiClient.loadTokensIfNeeded();
      const token = apiClient.getToken();
      if (token) {
        // Try to get user data, but don't fail hard if network is unreachable
        try {
          const userData = await apiClient.getCurrentUser();
          setUser(userData);
          await checkRecoveryQuestions();
        } catch (error: any) {
          // Handle different error types
          const status = error.response?.status;
          const isNetworkError = error.code === 'ECONNABORTED' || 
                                 error.message?.includes('timeout') ||
                                 error.message?.includes('Network Error');
          
          if (isNetworkError) {
            // Network/timeout error - keep token but don't set user
            // User will need to retry when network is available
            console.warn('Network error checking auth, keeping token for retry');
            setUser(null); // Show login screen but keep token
          } else if (status === 401 || status === 403) {
            // Unauthorized/Forbidden - token is invalid
            console.warn('Token invalid, clearing auth');
            await apiClient.logout();
            setUser(null);
          } else if (status === 500) {
            // Server error - could be database issue, invalid token, etc.
            // Clear token and show login to be safe
            console.warn('Server error checking auth, clearing token:', error.response?.data);
            await apiClient.logout();
            setUser(null);
          } else if (status === 429) {
            // Rate limited - token is still valid, don't clear or logout
            console.warn('Auth check rate limited, keeping token for retry');
            setUser(null);
          } else {
            // Other errors - clear token to be safe
            console.warn('Auth check error, clearing token:', error);
            await apiClient.logout();
            setUser(null);
          }
        }
      }
    } catch (error) {
      // Not authenticated or unexpected error
      console.warn('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (data: LoginRequest) => {
    const response = await apiClient.login(data);
    setUser(response.user);
    await checkRecoveryQuestions();
  };

  const register = async (data: RegisterRequest) => {
    await apiClient.register(data);
    // After registration, automatically log in
    await login({ email: data.email, password: data.password });
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const userData = await apiClient.getCurrentUser();
      setUser(userData);
    } catch (error) {
      setUser(null);
    }
  };

  const tryBiometricLogin = async (): Promise<boolean> => {
    try {
      await apiClient.loadTokensIfNeeded();
      const token = apiClient.getToken();
      if (!token) return false;
      const userData = await apiClient.getCurrentUser();
      setUser(userData);
      await checkRecoveryQuestions();
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        needsRecoveryQuestions,
        completeRecoveryQuestions,
        login,
        register,
        logout,
        refreshUser,
        tryBiometricLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

