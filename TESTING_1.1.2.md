# Testing Guide for Version 1.1.2

## Pre-Testing Setup

1. **Run database migrations** to add performance indexes:
   ```bash
   python -c "import sys; sys.path.insert(0, '.'); from src.migrations import run_migrations; import logging; logging.basicConfig(level=logging.INFO); run_migrations()"
   ```

2. **Start the backend** (if not already running):
   ```bash
   ./start-backend-local.sh
   ```

3. **Start the frontend** (if testing web):
   ```bash
   cd frontend && npm run dev
   ```

4. **Start the mobile app** (if testing mobile):
   ```bash
   cd mobile && EXPO_PUBLIC_API_URL=http://localhost:8000 ./run-local.sh
   ```

---

## Test Checklist

### ✅ Recipe Notes & Ratings

#### Mobile App Tests

- [ ] **Display Notes & Rating in Recipe Box**
  1. Open the mobile app
  2. Navigate to "Recipe Box" tab
  3. Verify saved recipes show:
     - ⭐ Rating (if set) - e.g., "⭐ 4/5"
     - 📝 Notes section (if notes exist)
  4. Recipes without notes/rating should not show empty sections

- [ ] **Edit Notes & Rating from Recipe Detail**
  1. Open a saved recipe from Recipe Box
  2. Scroll to see "Add Notes & Rating" or "Edit Notes & Rating" button
  3. Tap the button
  4. Verify dialog opens with:
     - Rating slider (0-5)
     - Notes text area
  5. Set rating to 4
  6. Add notes: "Great recipe! Added extra garlic."
  7. Tap "Save"
  8. Verify success message appears
  9. Verify notes and rating are displayed on the detail screen
  10. Go back to Recipe Box
  11. Verify notes and rating are displayed in the list view

- [ ] **Update Existing Notes & Rating**
  1. Open a recipe that already has notes/rating
  2. Tap "Edit Notes & Rating"
  3. Change rating from 4 to 5
  4. Update notes
  5. Save
  6. Verify changes are reflected

#### Frontend (Web) Tests

- [ ] **Display Notes & Rating**
  1. Open web app in browser
  2. Navigate to "Recipe Box" page
  3. Verify saved recipes show:
     - ⭐ Rating display (if set)
     - 📝 Notes section (if notes exist)

- [ ] **Edit Notes & Rating**
  1. Click "✏️ Edit Notes & Rating" button on a recipe
  2. Verify edit form appears with:
     - Rating slider (0-5)
     - Notes textarea
  3. Set rating to 3
  4. Add notes: "Needs more salt next time"
  5. Click "Save"
  6. Verify form closes and notes/rating are displayed
  7. Refresh page
  8. Verify notes/rating persist

- [ ] **Cancel Edit**
  1. Click "Edit Notes & Rating"
  2. Make changes
  3. Click "Cancel"
  4. Verify changes are not saved
  5. Verify form closes

---

### ✅ UI/UX Improvements

#### Loading States

- [ ] **Mobile - Recipe Box Loading**
  1. Clear app cache or restart app
  2. Navigate to Recipe Box
  3. Verify loading spinner with "Loading your recipes..." message appears
  4. Verify smooth transition to content

- [ ] **Frontend - Recipe Box Loading**
  1. Open Recipe Box page
  2. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
  3. Verify loading spinner appears
  4. Verify "Loading your recipes..." message

#### Empty States

- [ ] **Mobile - Empty Recipe Box**
  1. Delete all saved recipes (or use a test account with no recipes)
  2. Navigate to Recipe Box
  3. Verify empty state shows:
     - 📚 Emoji
     - "No Recipes Yet" title
     - Helpful message
     - "Go to Recipes" button
  4. Tap "Go to Recipes" button
  5. Verify navigation to Recipes screen works

- [ ] **Frontend - Empty Recipe Box**
  1. Delete all saved recipes (or use test account)
  2. Navigate to Recipe Box page
  3. Verify empty state shows:
     - 📚 Large emoji
     - "No Recipes Yet" heading
     - Helpful message
     - "Go to Recipes" link
  4. Click "Go to Recipes" link
  5. Verify navigation works

#### Error States

- [ ] **Frontend - Error Handling**
  1. Stop the backend server
  2. Navigate to Recipe Box
  3. Verify error state shows:
     - ❌ Emoji
     - "Error Loading Recipes" message
     - Error details
     - "Try Again" button
  4. Start backend server
  5. Click "Try Again"
  6. Verify recipes load successfully

---

### ✅ Performance Indexes

- [ ] **Verify Indexes Created**
  1. Run migrations (see Pre-Testing Setup)
  2. Check logs for:
     - "✅ Created index ix_inventory_user_pantry_status"
     - "✅ Created index ix_saved_recipes_user_cuisine"
     - "✅ Created index ix_recent_recipes_user_generated"
     - etc.
  3. If indexes already exist, should see "already exists" messages (that's fine)

- [ ] **Performance Test** (Optional)
  1. Add 50+ recipes to test account
  2. Navigate to Recipe Box
  3. Verify page loads quickly (< 2 seconds)
  4. Filter by cuisine
  5. Verify filtering is fast

---

### ✅ Confirmation Dialogs

- [ ] **Delete Recipe Confirmation**
  1. Mobile: Tap "Delete" on a recipe
  2. Verify confirmation dialog appears: "Delete Recipe" / "Are you sure?"
  3. Tap "Cancel" - verify recipe is not deleted
  4. Tap "Delete" again, then "Delete" in dialog
  5. Verify recipe is deleted

  1. Frontend: Click "🗑️ Delete" on a recipe
  2. Verify browser confirmation dialog appears
  3. Click "Cancel" - verify recipe is not deleted
  4. Click "Delete" again, then confirm
  5. Verify recipe is deleted

---

## Edge Cases to Test

- [ ] **Empty Notes**
  - Save recipe with rating but no notes
  - Verify only rating displays (no empty notes section)

- [ ] **Zero Rating**
  - Set rating to 0
  - Verify rating doesn't display (0 means no rating)

- [ ] **Long Notes**
  - Add very long notes (500+ characters)
  - Verify notes display correctly (no truncation unless intentional)
  - Verify text wraps properly

- [ ] **Special Characters in Notes**
  - Add notes with emojis, quotes, newlines
  - Verify they save and display correctly

- [ ] **Concurrent Edits**
  - Open same recipe in two browser tabs
  - Edit in one tab
  - Verify other tab shows updated data after refresh

---

## Known Issues / Notes

- Rating slider in mobile uses 0-5 range (0 = no rating)
- Notes are optional (can be empty)
- Rating of 0 means "no rating" and won't display

---

## Quick Test Script

Run this to quickly verify backend endpoints:

```bash
# Test update saved recipe endpoint (replace RECIPE_ID and TOKEN)
curl -X PUT http://localhost:8000/api/recipes/saved/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Test notes", "rating": 4}'
```

---

## Success Criteria

✅ All tests pass  
✅ No console errors  
✅ No crashes  
✅ UI is responsive  
✅ Data persists after refresh  
✅ Performance is acceptable

---

## If Issues Found

1. Check browser console (F12) for errors
2. Check mobile app logs (Expo/Metro bundler)
3. Check backend logs for API errors
4. Verify database migrations ran successfully
5. Verify backend is running and accessible
