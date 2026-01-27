import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import apiClient from '../api/client';
import type { User, LoginRequest, RegisterRequest } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  const checkAuth = async () => {
    try {
      const token = apiClient.getToken();
      if (token) {
        // Try to get user data, but don't fail hard if network is unreachable
        try {
          const userData = await apiClient.getCurrentUser();
          setUser(userData);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
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

