#!/bin/bash
# Smoke test production API (https://pantry-api-154407938924.us-south1.run.app)

set -e
API="${SMOKE_API_URL:-https://pantry-api-154407938924.us-south1.run.app}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

rnd="smoke-$(date +%s)"
EMAIL="${rnd}@example.com"
PASS="SmokeTest123"

ok() { echo -e "${GREEN}✅ $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; exit 1; }
info() { echo -e "${BLUE}▶ $*${NC}"; }

info "Smoke testing $API"
echo ""

# 1. Health
info "1. GET /health"
h="$(curl -s -o /dev/null -w '%{http_code}' "$API/health")"
[ "$h" = "200" ] || fail "GET /health returned $h"
body="$(curl -s "$API/health")"
echo "$body" | grep -q '"status"' || fail "/health missing status"
ok "GET /health 200"
echo ""

# 2. Docs
info "2. GET /docs"
d="$(curl -s -o /dev/null -w '%{http_code}' "$API/docs")"
[ "$d" = "200" ] || fail "GET /docs returned $d"
ok "GET /docs 200"
echo ""

# 3. Register
info "3. POST /api/auth/register ($EMAIL)"
reg="$(curl -s -w '\n%{http_code}' -X POST "$API/api/auth/register" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=${EMAIL}&password=${PASS}&full_name=Smoke+Test+User")"
reg_code="$(echo "$reg" | tail -n1)"
reg_body="$(echo "$reg" | sed '$d')"
[ "$reg_code" = "201" ] || fail "POST /register returned $reg_code: $reg_body"
ok "POST /api/auth/register 201"
echo ""

# 4. Login
info "4. POST /api/auth/login"
login="$(curl -s -X POST "$API/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=${EMAIL}&password=${PASS}")"
access="$(echo "$login" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null)"
[ -n "$access" ] || fail "Login missing access_token: $login"
ok "POST /api/auth/login → access_token"
echo ""

# 5. /api/auth/me
info "5. GET /api/auth/me (Bearer)"
me="$(curl -s -w '\n%{http_code}' "$API/api/auth/me" -H "Authorization: Bearer $access")"
me_code="$(echo "$me" | tail -n1)"
[ "$me_code" = "200" ] || fail "GET /api/auth/me returned $me_code"
me_body="$(echo "$me" | sed '$d')"
echo "$me_body" | grep -q "$EMAIL" || fail "/me response missing email"
ok "GET /api/auth/me 200"
echo ""

# 6. /api/pantries
info "6. GET /api/pantries (auth)"
pan="$(curl -s -w '\n%{http_code}' "$API/api/pantries" -H "Authorization: Bearer $access")"
pan_code="$(echo "$pan" | tail -n1)"
[ "$pan_code" = "200" ] || fail "GET /api/pantries returned $pan_code"
ok "GET /api/pantries 200"
echo ""

# 7. /api/products (no auth required for list? Check - some may require auth)
info "7. GET /api/products (auth)"
prod="$(curl -s -w '\n%{http_code}' "$API/api/products" -H "Authorization: Bearer $access")"
prod_code="$(echo "$prod" | tail -n1)"
[ "$prod_code" = "200" ] || fail "GET /api/products returned $prod_code"
ok "GET /api/products 200"
echo ""

# 8. Unauthenticated /api/auth/me → 401
info "8. GET /api/auth/me without token → 401"
unauth="$(curl -s -o /dev/null -w '%{http_code}' "$API/api/auth/me")"
[ "$unauth" = "401" ] || fail "Expected 401 without token, got $unauth"
ok "GET /api/auth/me no token → 401"
echo ""

# 9. Admin login (if credentials provided)
if [ -n "${SMOKE_ADMIN_EMAIL}" ] && [ -n "${SMOKE_ADMIN_PASSWORD}" ]; then
  info "9. POST /api/auth/login (admin)"
  admin_login="$(curl -s -X POST "$API/api/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "email=${SMOKE_ADMIN_EMAIL}&password=${SMOKE_ADMIN_PASSWORD}")"
  admin_token="$(echo "$admin_login" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null)"
  [ -n "$admin_token" ] || fail "Admin login failed"
  ok "Admin login OK"
  echo ""
fi

echo -e "${GREEN}All smoke tests passed.${NC}"
