# Changelog

All notable changes to Smart Pantry will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.3] - 2026-01-30

### Added
- **Haptic feedback**: Light impact or success haptic on key actions (save recipe, delete item, add to inventory, process image, barcode add, save notes/rating, delete recipe, settings save). Uses `expo-haptics`; safe on simulator.
- **Skeleton loading**: Inventory, Recipe Box, Expiring, and Statistics screens now show skeleton placeholders instead of spinners during initial load for a more consistent loading experience.
- **Empty states**: Inventory shows "Add your first item" or "No items match your search" with clear copy; Statistics shows "No insights yet" with explanation to add items.

### Changed
- New `SkeletonInventoryRow` component for inventory list loading; Expiring and Statistics use generic `Skeleton` blocks.

---

## [2.3.2] - 2026-01-30

### Changed
- **Smaller initial inventory load**: Inventory and recipe-ingredient flows now request 100 items instead of 1000 for faster first load (InventoryScreen, RecipesScreen, RecipeDetailScreen).
- **Expiring screen virtualization**: Expiring screen now uses `SectionList` for Expired and Expiring Soon sections so long lists scroll smoothly and use less memory.

---

## [2.3.1] - 2026-01-30

### Added
- **Proactive offline detection**: Uses `@react-native-community/netinfo` so the app knows you're offline before any request; banner and messaging stay in sync with network state.
- **Offline guard on critical actions**: Save, delete, and process-image flows (Inventory, Recipe Box, Recipe Detail, Recipes, Settings) now check connectivity first and show a clear "You're offline. Please check your connection and try again." alert instead of a generic error.

### Changed
- `useOfflineStatus` now derives from NetInfo (and treats `isInternetReachable === null` as online). Exported `OFFLINE_ACTION_MESSAGE` for consistent copy.

### Note
- Token refresh on 401 and retry with backoff for network/5xx were already implemented in the API client; no code change in this release.

---

## [1.2.0] - 2026-01-29

### Added
- **Semantic Recipe Search**: Search saved recipes by meaning (e.g. "quick chicken dinner", "no fish")
  - Backend: Local embeddings (BAAI/bge-small-en-v1.5), FAISS index for fast search, optional in-memory fallback
  - API: `GET /api/recipes/saved/search?q=...&limit=...` (auth required)
  - Mobile Recipe Box: Search box runs semantic search on submit; results show "Recipes like: 'query'" with scores
  - Supports natural-language exclusions (e.g. "nothing with tuna"); lazy backfill of embeddings on first search
- **FAISS integration**: In-memory vector index per user for faster semantic search; rebuilds from DB when missing
- **OpenMP/threading fix**: Set `OMP_NUM_THREADS=1` at server start to avoid segfault with FAISS + sentence-transformers on macOS (Python 3.14)
- **FAISS integration tests**: `tests/test_faiss_service.py` (mocked embed dim, no model load)

### Changed
- Recipe Box filters: Added recipe type (entree, side, snack, beverage) and star rating filters
- Backend: `recipe_embeddings` table and migration; embedding upsert on save/tag update; FAISS add/remove on save/delete

### Fixed
- React Native hooks error in Recipe Box (useCallback before conditional return)

---

## [1.1.5] - 2026-01-25

### Added
- **Storage Location Selector for Photos**: Users can now select storage location (Pantry/Fridge/Freezer) before taking or choosing a photo
  - Location selector appears in the "Add Item" dialog
  - Selected location is automatically applied when processing photos
  - No need to manually edit items after adding them via photo

## [1.1.4] - 2026-01-25

### Added
- **Recipe Scaling**: Users can now scale saved recipes up/down by adjusting servings
  - Mobile: Slider to adjust servings (1-20) with quick +/- buttons
  - Frontend: Slider to adjust servings per recipe with quick controls
  - Ingredient amounts automatically scale proportionally
  - Improved fraction conversion (handles 3/8, 5/8, etc.)
- **Ingredient Table Layout**: Ingredients now displayed in table format with separate columns for names and amounts
  - Mobile: Two-column layout with ingredient name and amount
  - Frontend: HTML table with headers for better readability

### Fixed
- Fixed duplicate brand names in product displays (inventory and recipe ingredients)
- Fixed recipe ingredient scaling math - now correctly converts to fractions (e.g., 1/2 cup scaled by 0.75 = 3/8 cup)
- Fixed ingredient amount parsing when scaling from fractions (e.g., 1/2 cup no longer becomes "1/2 /2 cup")
- Improved brand name removal logic to handle edge cases (hyphens, spaces, multiple occurrences)

## [1.1.3] - 2026-01-24

### Fixed
- Fixed issue where deleting all notes content would not save (empty notes now properly clear the notes field)
- Improved error handling and logging in recipe notes/rating update flow

## [1.1.2] - 2026-01-25

### Added
- **Recipe Notes & Ratings**: Users can now add personal notes and rate saved recipes
  - Mobile: Edit notes/rating from recipe detail screen with dialog
  - Frontend: Edit notes/rating inline in Recipe Box page
  - Works for all saved recipes (old and new)
- **Performance Indexes**: Added composite database indexes for common query patterns
  - Inventory queries (user_id + pantry_id + status)
  - Saved recipes queries (user_id + cuisine/difficulty)
  - Recent recipes queries (user_id + generated_at)

### Changed
- Improved loading states with descriptive messages
- Improved empty states with helpful CTAs and better messaging
- Improved error states with retry buttons and clearer error messages

### Fixed
- Fixed Slider import error (use @react-native-community/slider instead of react-native-paper)
- Improved SavedRecipe detection logic for better compatibility

## [1.1.1] - 2026-01-25

### Fixed
- Fixed React Native rendering error where numbers must be wrapped in `<Text>` component
- Improved migration error handling for duplicate indexes
- Fixed GitHub Actions workflow to only deploy on push to main (not PRs)

## [1.1.0] - 2026-01-25

### Added
- **Recent Recipes Feature**: Users can now view and manage recently generated recipes
  - Backend: New `RecentRecipe` model and API endpoints (`/api/recipes/recent/*`)
  - Auto-save: Generated recipes are automatically saved to recent recipes
  - Mobile: Recent recipes section in Recipes screen with save/delete buttons
  - Frontend: Recent recipes section in Recipes page with save/delete functionality
  - Auto-cleanup: Recipes older than 7 days are automatically removed

### Changed
- Recipe generation endpoints now automatically save to recent recipes
- Improved error handling in recipe generation

## [1.0.0] - 2026-01-25

### Added
- Initial production release
- OCR image processing (Google Vision / Tesseract)
- AI-powered product extraction
- Recipe generation with flavor chemistry
- Multiple pantries per user
- Inventory management with expiration tracking
- Statistics and analytics
- Mobile app (React Native/Expo)
- Web frontend (React/Vite)
- Authentication & authorization
- Sentry error tracking
- Cloud Run deployment

---

[1.1.5]: https://github.com/aasimsyed/pantry/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/aasimsyed/pantry/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/aasimsyed/pantry/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/aasimsyed/pantry/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/aasimsyed/pantry/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/aasimsyed/pantry/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/aasimsyed/pantry/releases/tag/v1.0.0
