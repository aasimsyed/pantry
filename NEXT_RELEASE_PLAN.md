# Next Release Planning

## Recommended: Version 1.1.2 (PATCH) - Quick Wins

**Estimated effort:** 1-2 days  
**Value:** High (improves existing features, low risk)

### 1. Recipe Notes & Ratings (Backend Ready!)
**Why:** Backend already has `notes` and `rating` fields in `SavedRecipe` model - just need UI!

**Tasks:**
- [ ] Add notes/rating UI to mobile RecipeBoxScreen
- [ ] Add notes/rating UI to frontend RecipeBox page
- [ ] Add notes/rating UI to recipe detail screens
- [ ] Update API client methods to support notes/rating
- [ ] Add edit functionality for saved recipes

**Files to modify:**
- `mobile/src/screens/RecipeBoxScreen.tsx`
- `mobile/src/screens/RecipeDetailScreen.tsx`
- `frontend/src/pages/RecipeBox.tsx`
- `api/routers/recipes.py` (verify update endpoint works)

### 2. UI/UX Improvements
**Why:** Better user experience, fewer support issues

**Tasks:**
- [ ] Add loading skeletons (instead of just spinners)
- [ ] Improve empty states (better messaging, helpful CTAs)
- [ ] Better error messages (user-friendly, actionable)
- [ ] Add confirmation dialogs for destructive actions
- [ ] Improve mobile camera experience (better permissions handling)

### 3. Performance Optimizations
**Why:** Better performance = better user experience

**Tasks:**
- [ ] Add database indexes for common queries
- [ ] Optimize recipe generation queries
- [ ] Add response caching for statistics
- [ ] Optimize image processing pipeline

### 4. Error Handling Improvements
**Why:** Better error recovery, fewer user frustrations

**Tasks:**
- [ ] Better handling of expired tokens (auto-refresh)
- [ ] Retry logic for failed API calls
- [ ] Offline mode detection and messaging
- [ ] Better validation error messages

---

## Alternative: Version 1.2.0 (MINOR) - Shopping Lists

**Estimated effort:** 3-5 days  
**Value:** Very High (new feature users will love)

### Shopping Lists Feature

**Backend:**
- [ ] Create `ShoppingList` model (id, user_id, name, created_at, updated_at)
- [ ] Create `ShoppingListItem` model (id, list_id, product_name, quantity, unit, checked, notes)
- [ ] Add API endpoints:
  - `POST /api/shopping-lists` - Create list
  - `GET /api/shopping-lists` - Get user's lists
  - `GET /api/shopping-lists/{id}` - Get list details
  - `PUT /api/shopping-lists/{id}` - Update list
  - `DELETE /api/shopping-lists/{id}` - Delete list
  - `POST /api/shopping-lists/{id}/items` - Add item
  - `PUT /api/shopping-lists/{id}/items/{item_id}` - Update item
  - `DELETE /api/shopping-lists/{id}/items/{item_id}` - Delete item
  - `POST /api/recipes/{id}/shopping-list` - Create list from recipe missing ingredients
- [ ] Add migration for new tables

**Frontend:**
- [ ] Create ShoppingLists page
- [ ] Create ShoppingList detail page
- [ ] Add "Create Shopping List" button in Recipes page
- [ ] Add shopping list navigation

**Mobile:**
- [ ] Create ShoppingListsScreen
- [ ] Create ShoppingListDetailScreen
- [ ] Add shopping list tab/navigation
- [ ] Add "Create Shopping List" from recipe

**Features:**
- Create shopping list from recipe's missing ingredients
- Manually add/remove items
- Check off items as you shop
- Multiple shopping lists
- Share shopping lists (future)

---

## Decision Matrix

| Factor | 1.1.2 (Patch) | 1.2.0 (Minor) |
|--------|---------------|---------------|
| **Effort** | Low (1-2 days) | Medium (3-5 days) |
| **Risk** | Very Low | Low |
| **User Value** | High (polish) | Very High (new feature) |
| **Technical Debt** | Reduces | Neutral |
| **Marketing** | "Improvements" | "New Feature!" |

---

## Recommendation

**Start with 1.1.2 (Patch)** because:
1. ✅ Quick wins - Recipe notes/ratings are backend-ready
2. ✅ Low risk - improvements to existing features
3. ✅ Better foundation for 1.2.0
4. ✅ Can ship faster (1-2 days vs 3-5 days)

**Then do 1.2.0 (Minor)** because:
1. ✅ High user value (shopping lists are highly requested)
2. ✅ Natural progression from recipes
3. ✅ Good marketing story

---

## Implementation Order (1.1.2)

### Day 1: Recipe Notes & Ratings
1. Update mobile RecipeBoxScreen to show/edit notes/rating
2. Update frontend RecipeBox page
3. Add edit functionality
4. Test on both platforms

### Day 2: UI/UX & Performance
1. Add loading skeletons
2. Improve empty states
3. Add confirmation dialogs
4. Performance optimizations (indexes, caching)

---

## Success Metrics

**1.1.2:**
- Recipe notes/ratings usage > 30% of saved recipes
- Reduced error rate (better error handling)
- Improved page load times (performance)

**1.2.0:**
- Shopping list creation rate
- Shopping list completion rate
- User retention improvement
