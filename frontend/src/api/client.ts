import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  Product,
  Pantry,
  InventoryItem,
  Recipe,
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

class APIClient {
  private client: AxiosInstance;
  private baseTimeout: number = 10;
  private accessToken: string | null = null;

  constructor(baseURL: string = 'http://localhost:8000') {
    this.client = axios.create({
      baseURL,
      timeout: this.baseTimeout * 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage on initialization
    this.loadToken();

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      (config) => {
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
        // Handle 401 (Unauthorized) - token expired, try to refresh
        if (error.response?.status === 401 && this.accessToken) {
          try {
            await this.refreshAccessToken();
            // Retry original request
            if (error.config) {
              error.config.headers.Authorization = `Bearer ${this.accessToken}`;
              return this.client.request(error.config);
            }
          } catch (refreshError) {
            // Refresh failed, clear tokens and redirect
            this.clearTokens();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
          }
        }
        // Handle 403 (Forbidden) - no token or invalid token, redirect to login
        if (error.response?.status === 403) {
          this.clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        console.error('API request failed:', error);
        throw error;
      }
    );
  }

  // Token management
  private loadToken(): void {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token');
    }
  }

  setToken(token: string): void {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  setRefreshToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('refresh_token', token);
    }
  }

  clearTokens(): void {
    this.accessToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  getToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refresh_token');
    }
    return null;
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
    this.setToken(response.data.access_token);
    this.setRefreshToken(response.data.refresh_token);

    return response.data;
  }

  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
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
    this.clearTokens();
  }

  async refreshAccessToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
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

    this.setToken(response.data.access_token);
    if (response.data.refresh_token) {
      this.setRefreshToken(response.data.refresh_token);
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

  async updateProduct(productId: number, data: Partial<Product>): Promise<Product> {
    return this.request<Product>('PUT', `/api/products/${productId}`, { data });
  }

  async deleteProduct(productId: number): Promise<void> {
    return this.request<void>('DELETE', `/api/products/${productId}`);
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

  // User Settings
  async getUserSettings(): Promise<{ id: number; user_id: number; ai_provider?: string; ai_model?: string }> {
    return this.request('GET', '/api/user/settings');
  }

  async updateUserSettings(data: { ai_provider?: string; ai_model?: string }): Promise<{ id: number; user_id: number; ai_provider?: string; ai_model?: string }> {
    return this.request('PUT', '/api/user/settings', { data });
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

  async createInventoryItem(data: Partial<InventoryItem>): Promise<InventoryItem> {
    return this.request<InventoryItem>('POST', '/api/inventory', { data });
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

  async consumeItem(itemId: number, quantity?: number): Promise<InventoryItem> {
    return this.request<InventoryItem>('POST', `/api/inventory/${itemId}/consume`, {
      data: quantity ? { quantity } : {},
    });
  }

  // Expiration
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

  async getStatisticsByCategory(): Promise<Record<string, number>> {
    return this.request<Record<string, number>>('GET', '/api/statistics/by-category');
  }

  async getStatisticsByLocation(): Promise<Record<string, number>> {
    return this.request<Record<string, number>>('GET', '/api/statistics/by-location');
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
      timeout: 60000, // 60 seconds
    });
  }

  async generateRecipes(
    options: {
      required_ingredients?: string[];
      excluded_ingredients?: string[];
      max_recipes?: number;
      cuisine?: string;
      difficulty?: string;
      dietary_restrictions?: string[];
      allow_missing_ingredients?: boolean;
      pantry_id?: number;
    }
  ): Promise<Recipe[]> {
    const data: Record<string, any> = {
      max_recipes: options.max_recipes || 5,
      allow_missing_ingredients: options.allow_missing_ingredients || false,
    };
    if (options.required_ingredients) data.required_ingredients = options.required_ingredients;
    if (options.excluded_ingredients) data.excluded_ingredients = options.excluded_ingredients;
    if (options.cuisine) data.cuisine = options.cuisine;
    if (options.difficulty) data.difficulty = options.difficulty;
    if (options.dietary_restrictions) data.dietary_restrictions = options.dietary_restrictions;
    if (options.pantry_id) data.pantry_id = options.pantry_id;

    const timeout = Math.max(300000, (options.max_recipes || 5) * 30000 + 60000); // 5 minutes default

    return this.request<Recipe[]>('POST', '/api/recipes/generate', {
      data,
      timeout,
    });
  }

  // Image Processing & Source Directory
  async getSourceDirectory(): Promise<SourceDirectory> {
    return this.request<SourceDirectory>('GET', '/api/config/source-directory');
  }

  async setSourceDirectory(directory: string): Promise<SourceDirectory> {
    return this.request<SourceDirectory>('POST', '/api/config/source-directory', {
      data: { directory },
    });
  }

  async processImage(
    file: File,
    storageLocation: string = 'pantry'
  ): Promise<ProcessImageResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('storage_location', storageLocation);

    const response = await this.client.post<ProcessImageResult>(
      '/api/inventory/process-image',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minutes
      }
    );
    return response.data;
  }

  async refreshInventory(
    options: {
      source_directory?: string;
      storage_location?: string;
      min_confidence?: number;
    }
  ): Promise<RefreshInventoryResult> {
    const data: Record<string, any> = {
      storage_location: options.storage_location || 'pantry',
      min_confidence: options.min_confidence || 0.6,
    };
    if (options.source_directory) data.source_directory = options.source_directory;

    return this.request<RefreshInventoryResult>('POST', '/api/inventory/refresh', {
      data,
      timeout: 600000, // 10 minutes
    });
  }

  // Saved Recipes (Recipe Box)
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

  async getSavedRecipe(recipeId: number): Promise<SavedRecipe> {
    return this.request<SavedRecipe>('GET', `/api/recipes/saved/${recipeId}`);
  }

  async updateSavedRecipe(
    recipeId: number,
    recipeData: Partial<SavedRecipe>
  ): Promise<SavedRecipe> {
    return this.request<SavedRecipe>('PUT', `/api/recipes/saved/${recipeId}`, {
      data: recipeData,
    });
  }

  async deleteSavedRecipe(recipeId: number): Promise<void> {
    return this.request<void>('DELETE', `/api/recipes/saved/${recipeId}`);
  }
}

// Get API URL from environment variable, default to localhost
const getApiUrl = (): string => {
  // Vite uses import.meta.env for environment variables
  // Check for VITE_API_URL first, then fall back to localhost
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return apiUrl;
  }
  
  // Default to localhost for development
  return 'http://localhost:8000';
};

// Export singleton instance
export const apiClient = new APIClient(getApiUrl());
export default apiClient;

