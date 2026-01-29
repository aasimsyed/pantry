# Performance Improvement Suggestions

Actionable suggestions from a codebase review, ordered by impact vs effort.

---

## 1. Mobile: Virtualize long lists (high impact)

**Current:** `InventoryScreen`, `RecipeBoxScreen`, `RecipesScreen`, and `ExpiringScreen` use `ScrollView` + `.map()`, so every item is mounted at once. With hundreds of items this hurts scroll performance and memory.

**Suggestion:** Use **FlatList** (or **FlashList** from `@shopify/flash-list` for better perf) for any list that can grow large:

- **InventoryScreen** — replace the `ScrollView` that wraps `filteredItems.map(...)` with `FlatList`/`FlashList` and `keyExtractor` + `renderItem`. Use `getItemLayout` if row height is fixed for faster scroll.
- **RecipeBoxScreen** — same pattern for `recipes.map(...)`.
- **RecipesScreen** — virtualize the generated + recent recipe list (or at least the section that can have 20+ items).
- **ExpiringScreen** — virtualize the expiring items list.

**Best practice:** Keep list item components small and wrap them in `React.memo` so only visible items re-render when data changes.

---

## 2. Backend: Paginate inventory in the database (high impact)

**Current:** `get_inventory` calls `service.get_all_inventory()`, which runs `q.all()` and loads **all** inventory rows. The API then filters by `location`/`item_status` in Python and slices `items[skip : skip + limit]`. For large pantries this is slow and memory-heavy.

**Suggestion:** Move filtering and pagination into the DB:

- In `db_service.py`, add a method that accepts `skip`, `limit`, `location`, `item_status`, `pantry_id`, and builds a single query with `.filter(...).order_by(...).offset(skip).limit(limit).all()`.
- In `api/routers/inventory.py`, call this method instead of `get_all_inventory()` + in-memory filter + slice.
- Ensure indexes exist on `InventoryItem` for `user_id`, `pantry_id`, `storage_location`, `status` (and composite if you filter by multiple).

---

## 3. Mobile & frontend: Reduce initial payload size (medium impact)

**Current:** Mobile and frontend call `getInventory(0, 1000)`, so the first load can request up to 1000 items.

**Suggestion:**

- **Option A:** Use a smaller default page size (e.g. 50–100) and implement “Load more” or infinite scroll (`FlatList` `onEndReached` + append next page). Combine with backend DB-level pagination (item 2).
- **Option B:** If you keep “load all,” at least avoid requesting 1000 when the UI only needs the first screen (e.g. load 50 first, then prefetch or load more on scroll).

Same idea for **Recipe Box** and **Recent Recipes** if those lists can grow large.

---

## 4. Frontend: Lazy-load route components (medium impact)

**Current:** `App.tsx` imports every page directly, so the initial JS bundle includes all routes (Inventory, Recipes, RecipeBox, Expiring, Statistics, Settings, etc.).

**Suggestion:** Use **React.lazy** and **Suspense** for route components:

```tsx
const Inventory = React.lazy(() => import('./pages/Inventory'));
const Recipes = React.lazy(() => import('./pages/Recipes'));
// ... etc.

<Route path="/inventory" element={<Suspense fallback={<PageSkeleton />}><ProtectedRoute><Inventory /></ProtectedRoute></Suspense>} />
```

This reduces initial bundle size and speeds up first paint; each page loads when first visited.

---

## 5. Mobile: Memoize heavy screens and list items (medium impact)

**Current:** Only a few places use `useCallback`/`useMemo`. Heavy screens re-create callbacks and recompute derived data on every render.

**Suggestion:**

- **RecipesScreen:** Wrap `loadAvailableIngredients`, `loadRecentRecipes`, and other stable callbacks in `useCallback` (you already do for some). Memoize derived values (e.g. filtered option lists) with `useMemo`.
- **InventoryScreen:** Memoize `filteredItems` with `useMemo` (deps: `items`, `searchQuery`, filters). Pass stable callbacks to list item (e.g. `onPress`) via `useCallback`.
- **RecipeBoxScreen / RecipeDetailScreen:** Same idea — `useCallback` for handlers passed to children, `useMemo` for parsed ingredients/instructions if they’re derived from props/state.
- **List item components:** Extract each row/card into a small component and wrap with `React.memo` so parent state updates don’t re-render every row.

---

## 6. Mobile: Debounce search input (low effort)

**Current:** `InventoryScreen` search updates `searchQuery` on every keystroke, which can trigger re-renders and re-filter of a large list on each change.

**Suggestion:** Debounce the value used for filtering (e.g. 200–300 ms). Keep the input responsive for display, but drive the actual filter with a debounced value so you do fewer heavy filters and re-renders.

---

## 7. Backend: Ensure indexes on hot paths (low effort)

**Suggestion:** Confirm that tables used in list endpoints have indexes that match the query filters and sort:

- **InventoryItem:** `(user_id, pantry_id)`, and optionally `(pantry_id, storage_location)`, `(pantry_id, status)` if you filter by those.
- **Saved recipes / recent recipes:** indexes on `user_id` and any columns used in `WHERE`/`ORDER BY`.

Check with your DB or migration tool; add indexes if missing.

---

## 8. Optional: Short-term caching for list data (lower priority)

**Current:** Screens refetch inventory/recipes on focus or when dependencies change, which is correct for freshness but can cause redundant requests if the user switches tabs quickly.

**Suggestion:** Consider a short-lived cache (e.g. 30–60 seconds) for list responses keyed by `pantry_id` (and filters). Serve from cache on focus if not stale, then refetch in background and update UI. This is optional and only worth it if you observe unnecessary duplicate requests.

---

## Summary

| Area        | Suggestion                          | Impact   | Effort   |
|------------|--------------------------------------|----------|----------|
| Mobile     | Virtualize lists (FlatList/FlashList)| High     | Medium   |
| Backend    | Paginate inventory in DB             | High     | Medium   |
| Mobile/Web | Smaller first page / “load more”     | Medium   | Medium   |
| Frontend   | Lazy-load routes                     | Medium   | Low      |
| Mobile     | useCallback / useMemo / React.memo   | Medium   | Low–Med  |
| Mobile     | Debounce search                      | Low–Med  | Low      |
| Backend    | Indexes on list queries               | Medium   | Low      |
| Optional   | Short-lived list cache                | Low      | Medium   |

Implementing **1** (virtualize lists) and **2** (DB-level inventory pagination) will give the largest gains for large pantries and many recipes.
