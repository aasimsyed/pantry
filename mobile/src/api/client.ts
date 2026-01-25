import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import type {
  Product,
  Pantry,
  InventoryItem,
  Recipe,
  RecentRecipe,
  SavedRecipe,
  Statistics,
  SourceDirectory,
  ProcessImageResult,
  RefreshInventoryResult,
  TokenResponse,
  RegisterRequest,
  LoginRequest,
  User,
} from '../types';

// API Base URL Configuration
// For production, set EXPO_PUBLIC_API_URL environment variable
// For development, uses local IP or localhost
const getApiBaseUrl = () => {
  // Production: Use environment variable or default production URL
  if (!__DEV__) {
    // In production, use environment variable or your deployed backend URL
    // Set this via EAS Secrets or app.json extra config
    return process.env.EXPO_PUBLIC_API_URL || 'https://pantry-api-apqja3ye2q-vp.a.run.app';
  }
  
  // Development: Use EXPO_PUBLIC_API_URL (set by run-local.sh) or fall back to production
  const devUrl = process.env.EXPO_PUBLIC_API_URL;
  if (devUrl) {
    return devUrl;
  }
  return 'https://pantry-api-apqja3ye2q-vp.a.run.app';
};

const API_BASE_URL = getApiBaseUrl();

if (__DEV__) {
  console.log('[API] Base URL:', API_BASE_URL);
}

class APIClient {
  private client: AxiosInstance;
  private baseTimeout: number = 30; // Increased to 30 seconds
  private accessToken: string | null = null;
  private isRefreshing: boolean = false; // Prevent concurrent refresh attempts

  constructor(baseURL: string = API_BASE_URL) {
    this.client = axios.create({
      baseURL,
      timeout: this.baseTimeout * 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token on initialization
    this.loadToken();

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      async (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Handle 401: token expired, try to refresh
        if (error.response?.status === 401 && this.accessToken && !this.isRefreshing) {
          // Skip refresh if this is already a refresh request (avoid infinite loop)
          if (error.config?.url?.includes('/api/auth/refresh')) {
            // Refresh token is invalid, clear tokens
            this.clearTokens();
          } else {
            // Token expired, try to refresh
            try {
              this.isRefreshing = true;
              await this.refreshAccessToken();
              // Retry original request
              if (error.config) {
                error.config.headers.Authorization = `Bearer ${this.accessToken}`;
                return this.client.request(error.config);
              }
            } catch (refreshError: any) {
              // Refresh failed (429 rate limit, 401 invalid token, etc.), clear tokens
              this.clearTokens();
              // Don't retry if it was a rate limit - user needs to wait
              if (refreshError.response?.status === 429) {
                console.warn('Token refresh rate limited, please log in again');
              }
            } finally {
              this.isRefreshing = false;
            }
          }
        }
        // Log error with more details for debugging
        if (error.response) {
          console.error(`API request failed: ${error.response.status} ${error.response.statusText}`, {
            url: error.config?.url,
            method: error.config?.method,
            data: error.response.data,
          });
        } else {
          console.error('API request failed:', error.message || error);
        }
        throw error;
      }
    );
  }

  // Token management
  private async loadToken(): Promise<void> {
    try {
      this.accessToken = await SecureStore.getItemAsync('access_token');
    } catch (error) {
      console.error('Error loading token:', error);
    }
  }

  private async setToken(token: string): Promise<void> {
    this.accessToken = token;
    try {
      await SecureStore.setItemAsync('access_token', token);
    } catch (error) {
      console.error('Error storing token:', error);
    }
  }

  private async setRefreshToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync('refresh_token', token);
    } catch (error) {
      console.error('Error storing refresh token:', error);
    }
  }

  private async clearTokens(): Promise<void> {
    this.accessToken = null;
    try {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  getToken(): string | null {
    return this.accessToken;
  }

  private async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('refresh_token');
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  // Authentication methods
  async register(data: RegisterRequest): Promise<{ message: string; details: { user_id: number; email: string } }> {
    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('password', data.password);
    if (data.full_name) {
      formData.append('full_name', data.full_name);
    }

    const response = await this.client.post('/api/auth/register', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async login(data: LoginRequest): Promise<TokenResponse> {
    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('password', data.password);

    const response = await this.client.post<TokenResponse>('/api/auth/login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    // Store tokens
    await this.setToken(response.data.access_token);
    await this.setRefreshToken(response.data.refresh_token);

    return response.data;
  }

  async logout(): Promise<void> {
    const refreshToken = await this.getRefreshToken();
    if (refreshToken) {
      try {
        const formData = new FormData();
        formData.append('refresh_token', refreshToken);
        await this.client.post('/api/auth/logout', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    await this.clearTokens();
  }

  async refreshAccessToken(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const formData = new FormData();
    formData.append('refresh_token', refreshToken);

    const response = await this.client.post<TokenResponse>('/api/auth/refresh', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    await this.setToken(response.data.access_token);
    if (response.data.refresh_token) {
      await this.setRefreshToken(response.data.refresh_token);
    }

    return response.data.access_token;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('GET', '/api/auth/me');
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.client.request<T>({
      method,
      url: endpoint,
      ...config,
    });
    return response.data;
  }

  // Health
  async healthCheck() {
    return this.request('GET', '/health');
  }

  // Pantries
  async getPantries(): Promise<Pantry[]> {
    return this.request<Pantry[]>('GET', '/api/pantries');
  }

  async getPantry(pantryId: number): Promise<Pantry> {
    return this.request<Pantry>('GET', `/api/pantries/${pantryId}`);
  }

  async getDefaultPantry(): Promise<Pantry> {
    return this.request<Pantry>('GET', '/api/pantries/default');
  }

  async createPantry(data: Partial<Pantry>): Promise<Pantry> {
    return this.request<Pantry>('POST', '/api/pantries', { data });
  }

  async updatePantry(pantryId: number, data: Partial<Pantry>): Promise<Pantry> {
    return this.request<Pantry>('PUT', `/api/pantries/${pantryId}`, { data });
  }

  async deletePantry(pantryId: number): Promise<void> {
    return this.request<void>('DELETE', `/api/pantries/${pantryId}`);
  }

  // Inventory
  async getInventory(
    skip: number = 0,
    limit: number = 100,
    location?: string,
    status?: string,
    pantryId?: number
  ): Promise<InventoryItem[]> {
    const params: Record<string, string | number> = { skip, limit };
    if (location) params.location = location;
    if (status) params.status = status;
    if (pantryId) params.pantry_id = pantryId;
    return this.request<InventoryItem[]>('GET', '/api/inventory', { params });
  }

  async getInventoryItem(itemId: number): Promise<InventoryItem> {
    return this.request<InventoryItem>('GET', `/api/inventory/${itemId}`);
  }

  async updateInventoryItem(
    itemId: number,
    data: Partial<InventoryItem>
  ): Promise<InventoryItem> {
    return this.request<InventoryItem>('PUT', `/api/inventory/${itemId}`, { data });
  }

  async deleteInventoryItem(itemId: number): Promise<void> {
    return this.request<void>('DELETE', `/api/inventory/${itemId}`);
  }

  async createInventoryItem(data: Partial<InventoryItem>): Promise<InventoryItem> {
    return this.request<InventoryItem>('POST', '/api/inventory', { data });
  }

  async getExpiringItems(days: number = 7): Promise<InventoryItem[]> {
    return this.request<InventoryItem[]>('GET', '/api/expiring', {
      params: { days },
    });
  }

  async getExpiredItems(): Promise<InventoryItem[]> {
    return this.request<InventoryItem[]>('GET', '/api/expired');
  }

  // Statistics
  async getStatistics(): Promise<Statistics> {
    return this.request<Statistics>('GET', '/api/statistics');
  }

  // Recipe Generation
  async generateSingleRecipe(
    options: {
      required_ingredients?: string[];
      excluded_ingredients?: string[];
      cuisine?: string;
      difficulty?: string;
      dietary_restrictions?: string[];
      avoid_names?: string[];
      allow_missing_ingredients?: boolean;
      pantry_id?: number;
    }
  ): Promise<Recipe> {
    const data: Record<string, any> = {
      allow_missing_ingredients: options.allow_missing_ingredients || false,
    };
    if (options.required_ingredients) data.required_ingredients = options.required_ingredients;
    if (options.excluded_ingredients) data.excluded_ingredients = options.excluded_ingredients;
    if (options.cuisine) data.cuisine = options.cuisine;
    if (options.difficulty) data.difficulty = options.difficulty;
    if (options.dietary_restrictions) data.dietary_restrictions = options.dietary_restrictions;
    if (options.avoid_names) data.avoid_names = options.avoid_names;
    if (options.pantry_id) data.pantry_id = options.pantry_id;

    return this.request<Recipe>('POST', '/api/recipes/generate-one', {
      data,
      timeout: 180000, // 3 minutes - AI generation can take time
    });
  }

  // Image Processing
  async processImage(
    uri: string,
    storageLocation: string = 'pantry',
    pantryId?: number
  ): Promise<ProcessImageResult> {
    // Create FormData for file upload
    // React Native FormData requires specific format
    const formData = new FormData();
    
    // Extract filename from URI
    const filename = uri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    // @ts-ignore - React Native FormData format
    formData.append('file', {
      uri,
      type,
      name: filename,
    } as any);
    formData.append('storage_location', storageLocation);
    if (pantryId !== undefined) {
      formData.append('pantry_id', pantryId.toString());
    }

    try {
      const response = await this.client.post<ProcessImageResult>(
        '/api/inventory/process-image',
        formData,
        {
          // Axios will automatically set Content-Type with boundary for FormData
          // Don't set it manually
          headers: {
            'Accept': 'application/json',
          },
          timeout: 120000, // 2 minutes
          transformRequest: (data, headers) => {
            // Remove Content-Type to let Axios set it with boundary
            delete headers['Content-Type'];
            return data;
          },
        }
      );
      return response.data;
    } catch (error: any) {
      // Provide better error messages
      if (error.response) {
        const message = error.response.data?.detail || error.response.data?.message || 'Failed to process image';
        throw new Error(message);
      }
      throw error;
    }
  }

  // Saved Recipes
  async saveRecipe(recipeData: Partial<SavedRecipe>): Promise<SavedRecipe> {
    return this.request<SavedRecipe>('POST', '/api/recipes/save', { data: recipeData });
  }

  async getSavedRecipes(
    cuisine?: string,
    difficulty?: string,
    limit: number = 100
  ): Promise<SavedRecipe[]> {
    const params: Record<string, string | number> = { limit };
    if (cuisine) params.cuisine = cuisine;
    if (difficulty) params.difficulty = difficulty;
    return this.request<SavedRecipe[]>('GET', '/api/recipes/saved', { params });
  }

  async deleteSavedRecipe(recipeId: number): Promise<void> {
    return this.request<void>('DELETE', `/api/recipes/saved/${recipeId}`);
  }

  async updateSavedRecipe(
    recipeId: number,
    notes?: string,
    rating?: number,
    tags?: string[]
  ): Promise<SavedRecipe> {
    const data: any = {};
    // Always include notes if provided (even if empty string, to allow clearing)
    if (notes !== undefined) data.notes = notes;
    if (rating !== undefined) data.rating = rating;
    if (tags !== undefined) data.tags = tags;
    return this.request<SavedRecipe>('PUT', `/api/recipes/saved/${recipeId}`, { data });
  }

  // Recent Recipes
  async getRecentRecipes(limit: number = 20): Promise<RecentRecipe[]> {
    return this.request<RecentRecipe[]>('GET', '/api/recipes/recent', {
      params: { limit },
    });
  }

  async getRecentRecipe(recipeId: number): Promise<RecentRecipe> {
    return this.request<RecentRecipe>('GET', `/api/recipes/recent/${recipeId}`);
  }

  async saveRecentRecipe(
    recipeId: number,
    notes?: string,
    rating?: number,
    tags?: string[]
  ): Promise<SavedRecipe> {
    const data: any = {};
    if (notes !== undefined) data.notes = notes;
    if (rating !== undefined) data.rating = rating;
    if (tags !== undefined) data.tags = tags;
    return this.request<SavedRecipe>('POST', `/api/recipes/recent/${recipeId}/save`, { data });
  }

  async deleteRecentRecipe(recipeId: number): Promise<void> {
    return this.request<void>('DELETE', `/api/recipes/recent/${recipeId}`);
  }

  // Products
  async getProducts(skip: number = 0, limit: number = 100): Promise<Product[]> {
    return this.request<Product[]>('GET', '/api/products', {
      params: { skip, limit },
    });
  }

  async getProduct(productId: number): Promise<Product> {
    return this.request<Product>('GET', `/api/products/${productId}`);
  }

  async createProduct(data: Partial<Product>): Promise<Product> {
    return this.request<Product>('POST', '/api/products', { data });
  }

  async searchProducts(
    query: string,
    category?: string,
    brand?: string
  ): Promise<Product[]> {
    const params: Record<string, string> = { q: query };
    if (category) params.category = category;
    if (brand) params.brand = brand;
    return this.request<Product[]>('GET', '/api/products/search', { params });
  }

  // User Settings
  async getUserSettings(): Promise<{ id: number; user_id: number; ai_provider?: string; ai_model?: string }> {
    return this.request('GET', '/api/user/settings');
  }

  async updateUserSettings(data: { ai_provider?: string; ai_model?: string }): Promise<{ id: number; user_id: number; ai_provider?: string; ai_model?: string }> {
    return this.request('PUT', '/api/user/settings', { data });
  }
}

// Export singleton instance
export const apiClient = new APIClient();
export default apiClient;

/**
 * Extract user-friendly error message from API errors.
 * Prefers API `detail` over axios "Request failed with status code 500".
 * Appends request_id for 500s when present so you can look up logs.
 */
export function getApiErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error);
  const err = error as { response?: { data?: { detail?: string; request_id?: string }; status?: number }; message?: string };
  const detail = err.response?.data?.detail;
  const requestId = err.response?.data?.request_id;
  const status = err.response?.status;
  let msg = typeof detail === 'string' && detail ? detail : err.message ?? 'Request failed';
  if (status === 500 && requestId) {
    msg += ` (request_id: ${requestId})`;
  }
  return msg;
}

