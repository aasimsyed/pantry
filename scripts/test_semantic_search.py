#!/usr/bin/env python3
"""Test semantic recipe search: register or login, then GET /api/recipes/saved/search."""
import os
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

import httpx

BASE = os.environ.get("API_BASE", "http://localhost:8000")
TEST_EMAIL = "test-semantic-search@example.com"
TEST_PASSWORD = "TestSearch123"


def main():
    email = os.environ.get("TEST_USER_EMAIL", TEST_EMAIL)
    password = os.environ.get("TEST_USER_PASSWORD", TEST_PASSWORD)
    q = os.environ.get("SEARCH_QUERY", "quick chicken dinner")
    limit = int(os.environ.get("SEARCH_LIMIT", "5"))

    print(f"API base: {BASE}")
    print(f"User: {email}")
    print(f"Search: q={q!r} limit={limit}")
    print()

    with httpx.Client(timeout=60.0) as client:
        # Login (form data); if 401, try registering test user then login
        r = client.post(
            f"{BASE}/api/auth/login",
            data={"email": email, "password": password},
        )
        if r.status_code == 401:
            reg = client.post(
                f"{BASE}/api/auth/register",
                data={"email": email, "password": password, "full_name": "Test Semantic Search"},
            )
            if reg.status_code in (200, 201):
                r = client.post(
                    f"{BASE}/api/auth/login",
                    data={"email": email, "password": password},
                )
            elif reg.status_code in (400, 409) and "already" in reg.text.lower():
                # User exists; retry login (password may have been wrong)
                r = client.post(
                    f"{BASE}/api/auth/login",
                    data={"email": email, "password": password},
                )
            elif reg.status_code not in (200, 201, 400, 409):
                print(f"Register failed: {reg.status_code} - {reg.text[:300]}")
                return 1
        if r.status_code != 200:
            print(f"Login failed: {r.status_code}")
            print(r.text[:500])
            return 1
        token = r.json().get("access_token")
        if not token:
            print("Login response had no access_token")
            return 1
        print("Login OK, got token")

        # Semantic search (may trigger lazy backfill + model load on first call)
        print("Calling semantic search (first call may load model)...")
        r2 = client.get(
            f"{BASE}/api/recipes/saved/search",
            params={"q": q, "limit": limit},
            headers={"Authorization": f"Bearer {token}"},
        )
        if r2.status_code != 200:
            print(f"Search failed: {r2.status_code}")
            print(r2.text[:500])
            return 1
        data = r2.json()
        print(f"Search OK: {len(data)} result(s)")
        for i, hit in enumerate(data, 1):
            rec = hit.get("recipe", {})
            score = hit.get("score", 0)
            print(f"  {i}. {rec.get('name', '?')} (score={score:.4f})")
        if not data:
            print("  (No saved recipes for this user; add some in Recipe Box to see results.)")
        return 0


if __name__ == "__main__":
    sys.exit(main())
