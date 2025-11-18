#!/bin/bash

API_URL="https://pantry.up.railway.app"

echo "🔐 Testing Railway Authentication..."
echo ""

echo "1. Testing Registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -F "email=test$(date +%s)@example.com" \
  -F "password=TestPass123!" \
  -F "full_name=Test User")

echo "$REGISTER_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$REGISTER_RESPONSE"
echo ""

if echo "$REGISTER_RESPONSE" | grep -q "user_id"; then
  echo "✅ Registration successful!"
  
  EMAIL=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['details']['email'])" 2>/dev/null)
  
  echo ""
  echo "2. Testing Login..."
  LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
    -F "email=$EMAIL" \
    -F "password=TestPass123!")
  
  echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
  echo ""
  
  if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo "✅ Login successful!"
    TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
    
    echo ""
    echo "3. Testing Protected Endpoint..."
    curl -s -X GET "$API_URL/api/inventory" \
      -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || echo "Failed"
    
    echo ""
    echo "✅ All authentication tests passed!"
  else
    echo "❌ Login failed"
  fi
else
  echo "❌ Registration failed"
  echo "Check Railway logs and ensure SECRET_KEY is set"
fi
