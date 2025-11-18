import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import type {
  Product,
  InventoryItem,
  Recipe,
  SavedRecipe,
  Statistics,
  SourceDirectory,
  ProcessImageResult,
  RefreshInventoryResult,
} from '../types';

// API Base URL Configuration
// For production, set EXPO_PUBLIC_API_URL environment variable
// For development, uses local IP or localhost
const getApiBaseUrl = () => {
  // Production: Use environment variable or default production URL
  if (!__DEV__) {
    // In production, use environment variable or your deployed backend URL
    // Set this via EAS Secrets or app.json extra config
    return process.env.EXPO_PUBLIC_API_URL || 'https://pantry.up.railway.app';
  }
  
  // Development: Use local IP for physical devices, localhost for simulators
  // You can override this with EXPO_PUBLIC_API_URL environment variable
  const devUrl = process.env.EXPO_PUBLIC_API_URL;
  if (devUrl) {
    return devUrl;
  }
  
  // Default development URL (update with your local IP)
  // For iOS Simulator: localhost works
  // For physical devices: use your computer's local IP
  return 'http://192.168.69.61:8000';  // Update this to your computer's local IP
};

const API_BASE_URL = getApiBaseUrl();

class APIClient {
  private client: AxiosInstance;
  private baseTimeout: number = 10;

  constructor(baseURL: string = API_BASE_URL) {
    this.client = axios.create({
      baseURL,
      timeout: this.baseTimeout * 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API request failed:', error);
        throw error;
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

  // Inventory
  async getInventory(
    skip: number = 0,
    limit: number = 100,
    location?: string,
    status?: string
  ): Promise<InventoryItem[]> {
    const params: Record<string, string | number> = { skip, limit };
    if (location) params.location = location;
    if (status) params.status = status;
    return this.request<InventoryItem[]>('GET', '/api/inventory', { params });
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

    return this.request<Recipe>('POST', '/api/recipes/generate-one', {
      data,
      timeout: 60000, // 60 seconds
    });
  }

  // Image Processing
  async processImage(
    uri: string,
    storageLocation: string = 'pantry'
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
}

// Export singleton instance
export const apiClient = new APIClient();
export default apiClient;

