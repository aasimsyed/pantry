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
  BarcodeProduct,
} from '../types';

// API Base URL Configuration
// For production, set EXPO_PUBLIC_API_URL environment variable
// For development, uses local IP or localhost
const getApiBaseUrl = () => {
  // Production: Use environment variable or default production URL
  if (!__DEV__) {
    // In production, use environment variable or your deployed backend URL
    // Set this via EAS Secrets or app.json extra config
    return process.env.EXPO_PUBLIC_API_URL || 'https://pantry-api-154407938924.us-south1.run.app';
  }
  
  // Development: Use EXPO_PUBLIC_API_URL (set by run-local.sh) or fall back to production
  const devUrl = process.env.EXPO_PUBLIC_API_URL;
  if (devUrl) {
    return devUrl;
  }
  return 'https://pantry-api-154407938924.us-south1.run.app';
};

const API_BASE_URL = getApiBaseUrl();

if (__DEV__) {
  console.log('[API] Base URL:', API_BASE_URL);
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const RETRYABLE_ERROR_CODES = ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'ERR_NETWORK'];

// Helper to check if error is retryable
function isRetryableError(error: any): boolean {
  // Network errors (no response)
  if (!error.response) {
    const code = error.code || error.message;
    return RETRYABLE_ERROR_CODES.some(retryableCode => 
      code?.includes(retryableCode) || 
      error.message?.includes('Network Error') ||
      error.message?.includes('timeout')
    );
  }
  // HTTP status codes that are retryable
  return RETRYABLE_STATUS_CODES.includes(error.response.status);
}

// Helper to calculate exponential backoff delay
function getRetryDelay(attempt: number): number {
  return RETRY_DELAY_BASE * Math.pow(2, attempt);
}

// Helper to sleep/delay
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class APIClient {
  private client: AxiosInstance;
  private baseTimeout: number = 30; // Increased to 30 seconds
  private accessToken: string | null = null;
  private isRefreshing: boolean = false; // Prevent concurrent refresh attempts
  private refreshSubscribers: Array<(token: string | null) => void> = []; // Queue for requests waiting on token refresh
  private pendingRequests: Array<() => Promise<any>> = []; // Queue for offline requests
  private isOnline: boolean = true; // Track online status
  private onAuthFailureCallback: (() => void) | null = null; // Callback for authentication failures

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

    // Add response interceptor for error handling, token refresh, and retry logic
    this.client.interceptors.response.use(
      (response) => {
        // Mark as online when we get a successful response
        if (!this.isOnline) {
          this.isOnline = true;
          this.processPendingRequests();
        }
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        const retryCount = originalRequest?._retryCount || 0;

        // Detect offline status
        const isNetworkError = !error.response && (
          error.code === 'ERR_NETWORK' ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ETIMEDOUT' ||
          error.message?.includes('Network Error') ||
          error.message?.includes('timeout')
        );

        if (isNetworkError) {
          this.isOnline = false;
        }

        // Handle 401: token expired, try to refresh
        if (error.response?.status === 401 && this.accessToken) {
          // Skip refresh if this is already a refresh request (avoid infinite loop)
          if (originalRequest?.url?.includes('/api/auth/refresh')) {
            // Refresh token is invalid, clear tokens
            await this.clearTokens(true);
            this.onRefreshComplete(null); // Notify waiting requests that refresh failed
          } else if (this.isRefreshing) {
            // Another request is already refreshing, wait for it to complete
            return new Promise((resolve, reject) => {
              this.refreshSubscribers.push((newToken: string | null) => {
                if (newToken && originalRequest) {
                  originalRequest.headers.Authorization = `Bearer ${newToken}`;
                  resolve(this.client.request(originalRequest));
                } else {
                  reject(error);
                }
              });
            });
          } else {
            // Token expired, try to refresh
            try {
              this.isRefreshing = true;
              await this.refreshAccessToken();
              this.onRefreshComplete(this.accessToken); // Notify waiting requests
              // Retry original request
              if (originalRequest) {
                originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
                return this.client.request(originalRequest);
              }
            } catch (refreshError: any) {
              // Refresh failed (429 rate limit, 401 invalid token, etc.), clear tokens
              await this.clearTokens(true);
              this.onRefreshComplete(null); // Notify waiting requests that refresh failed
              // Don't retry if it was a rate limit - user needs to wait
              if (refreshError.response?.status === 429) {
                console.warn('Token refresh rate limited, please log in again');
              }
            } finally {
              this.isRefreshing = false;
            }
          }
        }

        // Retry logic for retryable errors
        if (isRetryableError(error) && retryCount < MAX_RETRIES && originalRequest) {
          originalRequest._retryCount = retryCount + 1;
          const delay = getRetryDelay(retryCount);
          
          console.log(`Retrying request (attempt ${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms...`);
          
          await sleep(delay);
          return this.client.request(originalRequest);
        }

        // Log error with more details for debugging
        if (error.response) {
          console.error(`API request failed: ${error.response.status} ${error.response.statusText}`, {
            url: originalRequest?.url,
            method: originalRequest?.method,
            data: error.response.data,
            retryCount,
          });
        } else {
          console.error('API request failed:', error.message || error, {
            code: error.code,
            retryCount,
          });
        }
        throw error;
      }
    );
  }

  // Notify all queued requests that token refresh has completed
  private onRefreshComplete(newToken: string | null): void {
    this.refreshSubscribers.forEach((callback) => callback(newToken));
    this.refreshSubscribers = [];
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

  private async clearTokens(isAuthFailure: boolean = false): Promise<void> {
    this.accessToken = null;
    try {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      
      // Notify app of authentication failure
      if (isAuthFailure && this.onAuthFailureCallback) {
        this.onAuthFailureCallback();
      }
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }
  
  setOnAuthFailure(callback: () => void): void {
    this.onAuthFailureCallback = callback;
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

  async forgotPassword(
    email: string,
    newSetup?: boolean
  ): Promise<{
    has_existing_totp: boolean;
    totp_uri: string | null;
    qr_image_base64: string | null;
    has_recovery_questions?: boolean;
    recovery_questions?: Array<{ id: number; text: string }>;
  }> {
    const body = new URLSearchParams();
    body.append('email', email);
    if (newSetup === true) {
      body.append('new_setup', 'true');
    }
    const response = await this.client.post<{
      has_existing_totp: boolean;
      totp_uri: string | null;
      qr_image_base64: string | null;
      has_recovery_questions?: boolean;
      recovery_questions?: Array<{ id: number; text: string }>;
    }>('/api/auth/forgot-password', body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  }

  async getRecoveryQuestions(): Promise<{
    all_questions: Array<{ id: number; text: string }>;
    user_question_ids: number[];
  }> {
    return this.request<{
      all_questions: Array<{ id: number; text: string }>;
      user_question_ids: number[];
    }>('GET', '/api/auth/recovery-questions');
  }

  async setRecoveryQuestions(answers: Array<{ question_id: number; answer: string }>): Promise<{ message: string }> {
    return this.request<{ message: string }>('POST', '/api/auth/recovery-questions', { data: { answers } });
  }

  async verifyResetRecovery(
    email: string,
    answers: Array<{ question_id: number; answer: string }>
  ): Promise<{ reset_token: string }> {
    const response = await this.client.post<{ reset_token: string }>(
      '/api/auth/verify-reset-recovery',
      { email, answers },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  }

  async verifyResetTotp(email: string, code: string): Promise<{ reset_token: string }> {
    const body = new URLSearchParams();
    body.append('email', email);
    body.append('code', code);
    const response = await this.client.post<{ reset_token: string }>(
      '/api/auth/verify-reset-totp',
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data;
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const body = new URLSearchParams();
    body.append('token', token);
    body.append('new_password', newPassword);
    const response = await this.client.post<{ message: string }>(
      '/api/auth/reset-password',
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data;
  }

  // Instacart Integration

  async getInstacartStatus(): Promise<{ enabled: boolean; available: boolean }> {
    return this.request<{ enabled: boolean; available: boolean }>('GET', '/api/instacart/status');
  }

  async createInstacartRecipeLink(
    title: string,
    ingredients: Array<{
      name: string;
      quantity?: number;
      unit?: string;
      display_text?: string;
    }>,
    options?: {
      instructions?: string[];
      servings?: number;
      cooking_time_minutes?: number;
    }
  ): Promise<{ products_link_url: string; expires_at?: string }> {
    return this.request<{ products_link_url: string; expires_at?: string }>(
      'POST',
      '/api/instacart/recipe-link',
      {
        data: {
          title,
          ingredients,
          ...options,
        },
      }
    );
  }

  async createInstacartShoppingListLink(
    title: string,
    items: Array<{
      name: string;
      quantity?: number;
      unit?: string;
      display_text?: string;
    }>
  ): Promise<{ products_link_url: string; expires_at?: string }> {
    return this.request<{ products_link_url: string; expires_at?: string }>(
      'POST',
      '/api/instacart/shopping-list-link',
      {
        data: {
          title,
          items,
        },
      }
    );
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

  async deleteAllRecentRecipes(): Promise<{ message: string }> {
    return this.request<{ message: string }>('DELETE', '/api/recipes/recent');
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

  // Barcode lookup
  async lookupBarcode(barcode: string): Promise<BarcodeProduct> {
    return this.request<BarcodeProduct>('GET', `/api/products/barcode/${barcode}`);
  }

  // User Settings
  async getUserSettings(): Promise<{ id: number; user_id: number; ai_provider?: string; ai_model?: string }> {
    return this.request('GET', '/api/user/settings');
  }

  async updateUserSettings(data: { ai_provider?: string; ai_model?: string }): Promise<{ id: number; user_id: number; ai_provider?: string; ai_model?: string }> {
    return this.request('PUT', '/api/user/settings', { data });
  }

  // Account Management
  async deleteAccount(): Promise<{ message: string }> {
    return this.request<{ message: string }>('DELETE', '/api/auth/account');
  }

  // Offline request queue management
  private async processPendingRequests(): Promise<void> {
    if (this.pendingRequests.length === 0) return;
    
    console.log(`Processing ${this.pendingRequests.length} pending requests...`);
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    
    for (const requestFn of requests) {
      try {
        await requestFn();
      } catch (error) {
        console.error('Failed to process pending request:', error);
      }
    }
  }

  // Check if currently online
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }
}

// Export singleton instance
export const apiClient = new APIClient();
export default apiClient;

/**
 * Extract user-friendly error message from API errors.
 * Handles validation errors, network errors, and provides actionable messages.
 */
export function getApiErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error);
  
  const err = error as { 
    response?: { 
      data?: { 
        detail?: string | Array<{ loc?: string[]; msg?: string; type?: string }>;
        message?: string;
        request_id?: string;
        errors?: Record<string, string[]>;
      }; 
      status?: number;
    }; 
    message?: string;
    code?: string;
  };

  // Network/offline errors
  if (!err.response) {
    const code = err.code || err.message;
    if (code === 'ERR_NETWORK' || code === 'ECONNABORTED' || code === 'ETIMEDOUT' || 
        err.message?.includes('Network Error') || err.message?.includes('timeout')) {
      return 'No internet connection. Please check your network and try again.';
    }
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      return 'Cannot reach server. Please check your connection or try again later.';
    }
    return err.message || 'Network error occurred';
  }

  const status = err.response.status;
  const data = err.response.data || {};
  const requestId = data.request_id;

  // Validation errors (422)
  if (status === 422) {
    const detail = data.detail;
    
    // Array of validation errors
    if (Array.isArray(detail)) {
      const messages = detail
        .filter((item: any) => item.msg)
        .map((item: any) => {
          const field = item.loc?.slice(-1)[0] || 'field';
          return `${field}: ${item.msg}`;
        });
      return messages.length > 0 ? messages.join('\n') : 'Validation error';
    }
    
    // Object with field errors
    if (data.errors && typeof data.errors === 'object') {
      const messages = Object.entries(data.errors)
        .map(([field, errors]) => {
          const errorList = Array.isArray(errors) ? errors.join(', ') : String(errors);
          return `${field}: ${errorList}`;
        });
      return messages.length > 0 ? messages.join('\n') : 'Validation error';
    }
    
    // String detail
    if (typeof detail === 'string' && detail) {
      return detail;
    }
    
    return 'Please check your input and try again.';
  }

  // Authentication errors
  if (status === 401) {
    return 'Your session has expired. Please log in again.';
  }
  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }

  // Rate limiting
  if (status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // Server errors
  if (status !== undefined && status >= 500) {
    const detail = typeof data.detail === 'string' ? data.detail : data.message;
    let msg = detail || 'Server error occurred. Please try again later.';
    if (requestId) {
      msg += ` (ID: ${requestId})`;
    }
    return msg;
  }

  // Client errors (400, 404, etc.)
  if (status !== undefined && status >= 400) {
    const detail = typeof data.detail === 'string' ? data.detail : data.message;
    if (detail) return detail;
    if (status === 404) return 'Resource not found.';
    if (status === 400) return 'Invalid request. Please check your input.';
    return `Request failed (${status})`;
  }

  // Fallback
  const detail = typeof data.detail === 'string' ? data.detail : data.message;
  return detail || err.message || 'Request failed';
}

