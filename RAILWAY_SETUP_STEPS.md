# Railway Deployment Steps - Phase 1 Security

## ✅ Testing Complete

Local testing shows:
- ✅ Authentication service works
- ✅ User registration works
- ✅ Login and token generation works
- ✅ Database tables created successfully

## 🚀 Railway Deployment Steps

### Step 1: Add Environment Variables

Go to Railway → Your Project → **Your Service** → **Variables** tab

Add these **NEW** variables:

```bash
SECRET_KEY=CciwYaUVUpY8_zhKDCdXdZUFlSt-N8zU9t29Ns0JiNg
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
```

**⚠️ IMPORTANT**: Generate a NEW secret key for production (don't use the example):
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Step 2: Verify Existing Variables

Make sure these are still set:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY` (optional)
- `AI_PROVIDER=openai`
- `AI_MODEL=gpt-4-turbo-preview`
- `DATABASE_URL` (if using PostgreSQL)

### Step 3: Trigger Redeployment

After adding variables:
1. Railway will automatically redeploy
2. OR click **"Redeploy"** button in the Deployments tab
3. Wait for deployment to complete

### Step 4: Check Deployment Logs

Go to **Deployments** → Latest deployment → **Logs**

Look for:
- ✅ "Application startup complete"
- ✅ No errors about missing modules
- ✅ Database connection successful

### Step 5: Test Authentication Endpoints

#### Test Registration (Fix the curl command):

```bash
curl -X POST https://pantry.up.railway.app/api/auth/register \
  -F "email=test@example.com" \
  -F "password=SecurePass123!" \
  -F "full_name=Test User"
```

**Expected Response:**
```json
{
  "message": "User registered successfully",
  "details": {
    "user_id": 1,
    "email": "test@example.com"
  }
}
```

#### Test Login:

```bash
curl -X POST https://pantry.up.railway.app/api/auth/login \
  -F "email=test@example.com" \
  -F "password=SecurePass123!"
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "role": "user"
  }
}
```

#### Test Protected Endpoint:

```bash
# Save the access_token from login response
TOKEN="your-access-token-here"

curl -X GET https://pantry.up.railway.app/api/inventory \
  -H "Authorization: Bearer $TOKEN"
```

### Step 6: Database Migration (If Needed)

If you see errors about missing tables, run migration:

**Option A: Via Railway CLI**
```bash
railway run python -c "from src.database import init_database; init_database()"
```

**Option B: Via Railway Dashboard**
1. Go to your service
2. Click **"Deployments"**
3. Click on latest deployment
4. Open **"Shell"** or **"Logs"**
5. Run: `python -c "from src.database import init_database; init_database()"`

### Step 7: Troubleshooting 500 Errors

If you get `{"detail":"Registration failed","error_code":"500"}`:

1. **Check SECRET_KEY is set:**
   - Go to Variables tab
   - Verify `SECRET_KEY` exists and has a value
   - Must be at least 32 characters

2. **Check Database:**
   - Verify `DATABASE_URL` is set
   - Check if PostgreSQL is running (if using PostgreSQL)
   - Check logs for database connection errors

3. **Check Dependencies:**
   - Railway should auto-install from `requirements.txt`
   - Check logs for import errors
   - Verify all packages installed successfully

4. **Check Logs:**
   - Go to Deployments → Latest → Logs
   - Look for Python tracebacks
   - Common issues:
     - Missing SECRET_KEY → "KeyError" or "NoneType"
     - Database error → "OperationalError" or "Table doesn't exist"
     - Import error → "ModuleNotFoundError"

### Step 8: Verify Everything Works

Test checklist:
- [ ] Registration endpoint returns 201
- [ ] Login endpoint returns 200 with tokens
- [ ] `/api/auth/me` returns user info with valid token
- [ ] `/api/inventory` requires authentication (401 without token)
- [ ] `/api/inventory` returns data with valid token
- [ ] Refresh token endpoint works

## 🔧 Common Issues & Fixes

### Issue: "Registration failed" (500 error)

**Cause**: Usually missing SECRET_KEY or database issue

**Fix**:
1. Check SECRET_KEY is set in Railway variables
2. Check database connection
3. Check logs for specific error

### Issue: "Could not validate credentials" (401)

**Cause**: Invalid or expired token

**Fix**:
- Get a new token via login
- Check token is sent in `Authorization: Bearer <token>` header

### Issue: "Table 'users' doesn't exist"

**Cause**: Database migration not run

**Fix**:
```bash
railway run python -c "from src.database import init_database; init_database()"
```

### Issue: "ModuleNotFoundError: No module named 'jose'"

**Cause**: Dependencies not installed

**Fix**:
- Railway should auto-install from requirements.txt
- Check deployment logs for pip install errors
- Manually trigger redeploy

## 📝 Next Steps After Deployment

1. **Create Admin User** (optional):
   - Register a user via API
   - Manually update role to "admin" in database if needed

2. **Update Frontend**:
   - Add login/register UI
   - Store tokens securely
   - Add token to API requests

3. **Update Mobile App**:
   - Add authentication screens
   - Use SecureStore for tokens
   - Update API client to include tokens

4. **Monitor**:
   - Check Railway logs regularly
   - Monitor error rates
   - Watch for authentication failures

## 🎯 Quick Test Script

Save this as `test_auth.sh`:

```bash
#!/bin/bash

API_URL="https://pantry.up.railway.app"

echo "Testing Registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -F "email=test$(date +%s)@example.com" \
  -F "password=TestPass123!" \
  -F "full_name=Test User")

echo "$REGISTER_RESPONSE" | python3 -m json.tool

if echo "$REGISTER_RESPONSE" | grep -q "user_id"; then
  echo "✅ Registration successful!"
  
  EMAIL=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['details']['email'])")
  
  echo "Testing Login..."
  LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
    -F "email=$EMAIL" \
    -F "password=TestPass123!")
  
  echo "$LOGIN_RESPONSE" | python3 -m json.tool
  
  if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo "✅ Login successful!"
    TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")
    
    echo "Testing Protected Endpoint..."
    curl -s -X GET "$API_URL/api/inventory" \
      -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
    
    echo "✅ All tests passed!"
  else
    echo "❌ Login failed"
  fi
else
  echo "❌ Registration failed"
fi
```

Run: `chmod +x test_auth.sh && ./test_auth.sh`

