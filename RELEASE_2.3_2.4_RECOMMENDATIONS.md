# Release Recommendations: 2.3.x (Patch) & 2.4.0 (Minor)

You’re at **2.3.0 build 106** (App Store). Below are high-value, low-risk ideas for **patch** (2.3.x) and **minor** (2.4.0) releases.

---

## 2.3.x — Patch releases (high value, low risk)

**Goal:** Polish, reliability, performance, and App Store readiness without new features.

### 1. Reliability & error recovery (2.3.1)

- **Token refresh:** Ensure 401s trigger refresh and retry (you have `refreshSubscribers` in client; verify refresh is used on all critical calls and that expired tokens don’t leave the user stuck).
- **Retry logic:** Add 1–2 retries with backoff for transient failures (network, 5xx) on key flows (load inventory, load recipes, save recipe).
- **Offline messaging:** Use `OfflineBanner` consistently; on critical actions (save, delete) show a clear “You’re offline” message instead of a generic error.

**Why:** Fewer “something went wrong” dead-ends and better behavior on flaky networks.

### 2. Performance (2.3.2)

- **Virtualize long lists:** Replace `ScrollView` + `.map()` with **FlatList** (or FlashList) on:
  - **InventoryScreen** (can be hundreds of items)
  - **RecipeBoxScreen** (saved recipes)
  - **ExpiringScreen**
- **Smaller initial load:** Reduce first-page inventory/recipe request from 1000 to ~50–100; add “Load more” or infinite scroll and align with backend pagination when you add it.

**Why:** Smoother scrolling and lower memory on large pantries (already called out in `PERFORMANCE_SUGGESTIONS.md`).

### 3. UX polish (2.3.3)

- **Haptic feedback:** Light haptic on key actions (save recipe, delete item, add to inventory, barcode success) for clearer feedback.
- **Skeletons everywhere:** Use your existing `Skeleton` component on all main screens (Inventory, Recipes, Recipe Box, Expiring, Statistics) so loading feels consistent.
- **Empty states:** One pass on copy and CTAs (e.g. “Add your first item”, “Generate recipes to get started”) so every list has a clear next step.

**Why:** App feels more responsive and intentional; good for reviews and retention.

### 4. Accessibility & App Store (2.3.4)

- **Accessibility:** Add `accessibilityLabel` / `accessibilityHint` on primary actions and list items (you already do in some places; extend to Recipe Box, Expiring, Statistics). Ensure minimum touch targets (44pt).
- **Support URL:** Add a support/contact link in Settings (and in App Store metadata) so users and Review have a clear path to you.
- **Privacy / compliance:** Double-check that all permission strings and privacy usage (camera, photos, Face ID) match current behavior and App Store requirements.

**Why:** Better accessibility and fewer “where do I get help?” moments; supports smooth App Review.

### 5. Stability (ongoing 2.3.x)

- **Sentry-driven fixes:** Triage top crashes/errors in Sentry and fix in the next patch (e.g. edge cases in recipe save/delete, barcode flow, OCR).
- **Edge cases:** Explicit handling for empty/malformed API responses, and for “save recipe” when already saved (idempotent or clear message).

**Why:** Fewer 1-star reviews from rare but impactful bugs.

---

## 2.4.0 — Minor release (new feature)

**Goal:** One clear, shippable feature that fits the roadmap and differentiates the app.

### Option A: Shopping lists (recommended)

**Idea:** Create and manage shopping lists; optionally “Create list from missing ingredients” from a recipe.

- **Backend:** `ShoppingList` + `ShoppingListItem` models, CRUD + “create from recipe” endpoint (see `NEXT_RELEASE_PLAN.md`).
- **Mobile:** New tab or screen: list of lists, list detail with checkable items, “Add from recipe” from Recipe Detail.
- **Scope:** Single-user lists first; sharing can be 2.5.0.

**Why:** Directly extends “what can I make?” → “what do I need to buy?” and matches your existing roadmap. High perceived value for moderate effort.

### Option B: Expiration reminders (push notifications)

**Idea:** “Your milk expires in 2 days” (and similar) via push.

- **Backend:** No new models; optionally a small “notification preferences” and “last notified” to avoid spam.
- **Mobile:** Add `expo-notifications`, request permission, schedule local notifications (or call a small backend job that sends push) based on expiring items.
- **Scope:** Start with “items expiring in 1–3 days” and one daily digest; tune later.

**Why:** Uses data you already have (Expiring screen) and increases re-opens; requires notification setup and careful UX so it doesn’t feel spammy.

### Option C: Home screen widget (iOS)

**Idea:** Widget showing “X items expiring soon” or “Top 3 expiring” with tap‑through into the app.

- **Mobile:** Use `expo-widgets` or native widget extension; read from shared storage/API.
- **Scope:** One widget size (e.g. small) for expiring count or list.

**Why:** Visibility on the home screen and a modern iOS feature; effort is non-trivial (widget extension, data pipeline).

---

## Suggested ordering

| Version   | Focus                                      | Rationale                                      |
|----------|---------------------------------------------|-------------------------------------------------|
| **2.3.1** | Token refresh, retries, offline messaging   | Fewer “broken” moments with minimal code        |
| **2.3.2** | FlatList + smaller first page               | Big win for users with lots of items/recipes    |
| **2.3.3** | Haptics, skeletons, empty states            | Noticeable polish                               |
| **2.3.4** | Accessibility, support URL, privacy check   | App Store and inclusivity                       |
| **2.4.0** | Shopping lists (Option A)                   | One strong feature that fits the product story  |

You can merge 2.3.2 and 2.3.3 if you want fewer patch releases, or slip Sentry-driven fixes into whichever patch is open when you fix them.

---

## Quick reference: already in place

- Recipe notes & ratings (backend + mobile)
- Semantic recipe search
- Confirmation dialogs for destructive actions (inventory, pantry, recipe, account)
- Recipe share (Share API)
- Dark mode, FAB speed dial, barcode scanner, Instacart link
- Offline banner component (use it everywhere it matters)

---

## Summary

- **2.3.x:** Reliability (tokens, retries, offline), performance (lists, pagination), polish (haptics, skeletons, empty states), accessibility and support URL, plus Sentry-driven stability fixes.
- **2.4.0:** Shopping lists as the flagship feature; push reminders or a widget as strong follow-ups for 2.5.0+.

If you tell me which patch or 2.4.0 item you want to do first, I can break it into concrete tasks and file/line-level changes.
