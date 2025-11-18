import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
          // If it's a network/timeout error, keep the token but don't set user
          // User will need to retry when network is available
          if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            console.warn('Network timeout checking auth, keeping token for retry');
            // Don't clear token on timeout - might just be network issue
          } else {
            // Other errors (401, etc.) mean token is invalid
            await apiClient.logout();
            setUser(null);
          }
        }
      }
    } catch (error) {
      // Not authenticated or network error
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

