# Railway Deployment with Security (Phase 1)

## Prerequisites

✅ Phase 1 security is implemented  
✅ Dependencies are installed  
✅ Database schema is updated  

## Step 1: Update Railway Environment Variables

Go to your Railway project → Your service → **Variables** tab and add:

### Required Security Variables

```bash
SECRET_KEY=CciwYaUVUpY8_zhKDCdXdZUFlSt-N8zU9t29Ns0JiNg
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
```

**⚠️ IMPORTANT**: Generate a NEW secret key for production:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Existing Variables (Keep These)

```bash
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
AI_PROVIDER=openai
AI_MODEL=gpt-4-turbo-preview
DATABASE_URL=your-postgres-url  # If using PostgreSQL
```

## Step 2: Verify Dependencies in Railway

Railway will automatically install dependencies from `requirements.txt` when you deploy. The new security packages are already in `requirements.txt`:

- `python-jose[cryptography]>=3.3.0`
- `passlib[bcrypt]>=1.7.4`
- `slowapi>=0.1.9`
- `email-validator>=2.1.0`

## Step 3: Database Migration on Railway

### Option A: Automatic (Recommended)

Railway will run `init_database()` automatically when the app starts if you have this in your startup code. The database schema will be created automatically.

### Option B: Manual Migration

If you need to run migration manually:

1. Go to Railway → Your service → **Deployments**
2. Click on the latest deployment
3. Open the **Logs** tab
4. Or use Railway CLI:
   ```bash
   railway run python -c "from src.database import init_database; init_database()"
   ```

## Step 4: Test Authentication After Deployment

Once deployed, test the authentication endpoints:

### 1. Register a User

```bash
curl -X POST https://pantry.up.railway.app/api/auth/register \
  -F "email=test@example.com" \
  -F "password=SecurePass123!" \
  -F "full_name=Test User"
```

Expected response:
```json
{
  "message": "User registered successfully",
  "details": {
    "user_id": 1,
    "email": "test@example.com"
  }
}
```

### 2. Login

```bash
curl -X POST https://pantry.up.railway.app/api/auth/login \
  -F "email=test@example.com" \
  -F "password=SecurePass123!"
```

Expected response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "role": "user"
  }
}
```

### 3. Access Protected Endpoint

```bash
curl -X GET https://pantry.up.railway.app/api/inventory \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Get Current User Info

```bash
curl -X GET https://pantry.up.railway.app/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Step 5: Update Frontend/Mobile App

### For React Frontend

Update `frontend/src/api/client.ts` to include authentication:

```typescript
// Add token storage
let accessToken: string | null = null;
let refreshToken: string | null = null;

// Store tokens after login
export function setAuthTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

// Get access token
export function getAccessToken(): string | null {
  return accessToken || localStorage.getItem('access_token');
}

// Add to all API requests
const token = getAccessToken();
if (token) {
  config.headers = {
    ...config.headers,
    Authorization: `Bearer ${token}`
  };
}
```

### For React Native Mobile App

Update `mobile/src/api/client.ts`:

```typescript
import * as SecureStore from 'expo-secure-store';

// Store tokens
export async function setAuthTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync('access_token', access);
  await SecureStore.setItemAsync('refresh_token', refresh);
}

// Get access token
export async function getAccessToken(): Promise<string | null> {
  return await SecureStore.getItemAsync('access_token');
}

// Add to requests
const token = await getAccessToken();
if (token) {
  config.headers = {
    ...config.headers,
    Authorization: `Bearer ${token}`
  };
}
```

## Step 6: Handle Token Refresh

Implement automatic token refresh when access token expires:

```typescript
// In your API client error handler
if (error.response?.status === 401) {
  // Try to refresh token
  const refresh = await getRefreshToken();
  if (refresh) {
    const newAccess = await refreshAccessToken(refresh);
    if (newAccess) {
      // Retry original request with new token
      return retryRequest(originalRequest, newAccess);
    }
  }
  // If refresh fails, redirect to login
  redirectToLogin();
}
```

## Step 7: Security Checklist for Production

- [ ] ✅ SECRET_KEY is set and secure (not the example value)
- [ ] ✅ All environment variables are set in Railway
- [ ] ✅ Database migration completed
- [ ] ✅ Tested user registration
- [ ] ✅ Tested login and token generation
- [ ] ✅ Tested protected endpoints
- [ ] ✅ Frontend/mobile app updated to use tokens
- [ ] ✅ Token refresh implemented
- [ ] ✅ HTTPS is enforced (Railway does this automatically)
- [ ] ✅ CORS is configured for your frontend domain

## Troubleshooting

### Error: "Could not validate credentials"
- Check that SECRET_KEY is set correctly
- Verify token is being sent in Authorization header
- Check token hasn't expired (15 minutes for access tokens)

### Error: "User not found or inactive"
- User might have been deleted or deactivated
- Check database for user record

### Error: "Invalid or expired refresh token"
- Refresh token might have expired (30 days)
- Token might have been revoked (logout)
- User needs to login again

### Database Migration Issues
- Check Railway logs for errors
- Verify DATABASE_URL is correct
- Ensure PostgreSQL is running (if using PostgreSQL)

## Next Steps

After successful deployment:
1. Create your first admin user (manually in database or via API)
2. Test all authentication flows
3. Update frontend to use authentication
4. Monitor Railway logs for any issues
5. Consider Phase 2 features (MFA, email verification)

## Support

If you encounter issues:
1. Check Railway deployment logs
2. Verify all environment variables are set
3. Test endpoints using curl or Postman
4. Check database connection and schema

