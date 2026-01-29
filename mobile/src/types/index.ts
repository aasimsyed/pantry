// Type definitions for Smart Pantry API (React Native)

export interface Product {
  id: number;
  product_name: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  barcode?: string;
  default_storage_location?: string;
  typical_shelf_life_days?: number;
  created_at: string;
  updated_at: string;
}

export interface Pantry {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  location?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: number;
  product_id: number;
  product_name?: string;
  brand?: string;
  category?: string;
  quantity: number;
  unit: string;
  purchase_date?: string;
  expiration_date?: string;
  storage_location: 'pantry' | 'fridge' | 'freezer';
  image_path?: string;
  notes?: string;
  status: 'in_stock' | 'low' | 'expired' | 'consumed';
  user_id?: number;
  pantry_id?: number;
  pantry_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Recipe {
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prep_time: number;
  cook_time: number;
  servings: number;
  cuisine: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  available_ingredients: string[];
  missing_ingredients: string[];
  flavor_pairings?: FlavorPairing[];
  ai_model?: string;
  recent_recipe_id?: number; // ID if this recipe is in recent recipes
}

export interface RecipeIngredient {
  item: string;
  amount?: string;
  notes?: string;
}

export interface FlavorPairing {
  ingredients: string[];
  compounds: string;
  effect: string;
}

export interface SavedRecipe {
  id: number;
  name: string;
  description: string;
  cuisine: string;
  difficulty: string;
  prep_time: number;
  cook_time: number;
  servings: number;
  ingredients: string;
  instructions: string;
  notes?: string;
  rating?: number;
  tags?: string;
  ai_model?: string;
  flavor_pairings?: FlavorPairing[];
  created_at: string;
  updated_at: string;
}

export interface RecentRecipe {
  id: number;
  name: string;
  description?: string;
  cuisine?: string;
  difficulty?: string;
  prep_time?: number;
  cook_time?: number;
  servings?: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  available_ingredients?: string[];
  missing_ingredients?: string[];
  flavor_pairings?: FlavorPairing[];
  ai_model?: string;
  generated_at: string;
}

export interface Statistics {
  // Core counts
  total_items: number;
  total_products: number;
  in_stock: number;
  low_stock: number;
  expired: number;
  consumed: number;
  expiring_soon: number;
  
  // Pantry Health Score
  health_score: number;
  health_factors: Record<string, number>;
  
  // Expiration Timeline
  expiring_tomorrow: number;
  expiring_this_week: number;
  expiring_this_month: number;
  
  // Recipe Activity
  recipes_generated: number;
  recipes_saved: number;
  
  // Recent Activity
  items_added_this_week: number;
  items_added_this_month: number;
  
  // Storage Distribution
  storage_counts: Record<string, number>;
  
  // Legacy breakdowns
  by_category: Record<string, number>;
  by_location: Record<string, number>;
  by_status: Record<string, number>;
}

export interface SourceDirectory {
  source_directory: string;
  exists: boolean;
  is_directory: boolean;
}

export interface ProcessImageResult {
  success: boolean;
  message: string;
  item: InventoryItem;
  confidence: {
    ocr: number;
    ai: number;
    combined: number;
  };
  /** 'device' = ML Kit on-device; 'cloud' = Google Vision on server */
  ocr_source?: 'device' | 'cloud';
}

export interface RefreshInventoryResult {
  success: boolean;
  message: string;
  source_directory: string;
  results: {
    processed: number;
    skipped: number;
    failed: number;
    items_created: number;
    items_updated: number;
    errors: Array<{ image: string; error: string }>;
  };
}

// Authentication types
export interface User {
  id: number;
  email: string;
  full_name?: string;
  role: string;
  email_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Barcode lookup types
export interface BarcodeProduct {
  barcode: string;
  product_name: string;
  brand?: string;
  category?: string;
  quantity?: string;
  image_url?: string;
  nutrition_grade?: string;
  ingredients?: string;
  allergens?: string;
  found_in_database: boolean;
}


