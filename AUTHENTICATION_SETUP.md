# Authentication Setup - Web & Mobile Apps

## ✅ What's Been Added

### Web App (React)
- ✅ Authentication context (`AuthContext`) with login/register/logout
- ✅ Login page (`/login`)
- ✅ Register page (`/register`)
- ✅ Protected routes (all pages require authentication)
- ✅ Token storage in `localStorage`
- ✅ Automatic token refresh on 401 errors
- ✅ Logout button in sidebar
- ✅ User info display in header and sidebar

### Mobile App (React Native)
- ✅ Authentication context (`AuthContext`) with login/register/logout
- ✅ Login screen
- ✅ Register screen
- ✅ Protected navigation (shows auth screens when not logged in)
- ✅ Token storage in `expo-secure-store` (secure storage)
- ✅ Automatic token refresh on 401 errors
- ✅ Logout button on home screen
- ✅ User info display

## How to Use

### Web App

1. **Start the app:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Access the app:**
   - Go to `http://localhost:5173`
   - You'll be redirected to `/login` if not authenticated

3. **Register:**
   - Click "Create a new account" on login page
   - Or go directly to `/register`
   - Fill in email, password (min 8 chars), and optional full name
   - After registration, you'll be automatically logged in

4. **Login:**
   - Enter email and password
   - Click "Sign in"
   - You'll be redirected to the home page

5. **Logout:**
   - Click "Sign out" in the sidebar
   - You'll be redirected to login page

### Mobile App

1. **Start the app:**
   ```bash
   cd mobile
   npm start
   ```

2. **First launch:**
   - App shows Login screen
   - Tap "Don't have an account? Sign up" to register

3. **Register:**
   - Enter email, password (min 8 chars), and optional full name
   - Tap "Create Account"
   - After registration, you'll be automatically logged in

4. **Login:**
   - Enter email and password
   - Tap "Sign In"
   - You'll see the main app tabs

5. **Logout:**
   - Go to Home screen
   - Scroll to bottom
   - Tap "Sign Out" button

## API Client Features

Both web and mobile API clients now:
- ✅ Automatically include `Authorization: Bearer <token>` header
- ✅ Store tokens securely (localStorage for web, SecureStore for mobile)
- ✅ Refresh tokens automatically on 401 errors
- ✅ Clear tokens on logout
- ✅ Handle authentication errors gracefully

## Environment Variables

### Web App
Set `VITE_API_URL` in `.env` or `.env.local`:
```bash
VITE_API_URL=https://pantry.up.railway.app
```

### Mobile App
Set `EXPO_PUBLIC_API_URL` in `.env` or via EAS Secrets:
```bash
EXPO_PUBLIC_API_URL=https://pantry.up.railway.app
```

## Protected Endpoints

All these endpoints now require authentication:
- `/api/inventory` (GET, POST, PUT, DELETE)
- `/api/inventory/process-image`
- `/api/inventory/refresh`
- `/api/recipes/generate`
- `/api/recipes/save`
- `/api/recipes/saved`
- `/api/statistics`
- `/api/expiring`
- `/api/expired`

## Testing

### Test Registration
```bash
# Web
curl -X POST http://localhost:8000/api/auth/register \
  -F "email=test@example.com" \
  -F "password=TestPass123!" \
  -F "full_name=Test User"

# Mobile (same endpoint)
```

### Test Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -F "email=test@example.com" \
  -F "password=TestPass123!"
```

## Next Steps

1. ✅ Authentication is fully working
2. ✅ Users can register and login
3. ✅ All routes are protected
4. ✅ Tokens are stored securely

**You're all set!** Users can now register and login via both web and mobile apps.

