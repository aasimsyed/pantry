#!/usr/bin/env python3
"""
Test password reset using a token from the email.
Quick way to test the reset flow without a web frontend.
"""

import requests
import sys

def test_reset(token: str, new_password: str, api_url: str = "http://localhost:8000"):
    """Test password reset with token."""
    
    print("=" * 60)
    print("Password Reset with Token")
    print("=" * 60)
    print()
    print(f"API URL: {api_url}")
    print(f"Token: {token[:20]}...")
    print(f"New Password: {'*' * len(new_password)}")
    print()
    
    try:
        response = requests.post(
            f"{api_url}/api/auth/reset-password",
            data={
                "token": token,
                "new_password": new_password
            },
            timeout=10
        )
        
        if response.status_code == 200:
            print("✅ Password reset successful!")
            print()
            print(response.json().get("message", "Password reset"))
            print()
            print("You can now log in with your new password.")
            return True
        else:
            print(f"❌ Password reset failed: {response.status_code}")
            print()
            print(response.text)
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_password_reset_with_token.py <token> [new_password]")
        print()
        print("Example:")
        print('  python test_password_reset_with_token.py "eyJhbGci..." "MyNewPass123"')
        sys.exit(1)
    
    token = sys.argv[1]
    new_password = sys.argv[2] if len(sys.argv) > 2 else input("Enter new password (min 8 chars): ")
    
    if len(new_password) < 8:
        print("❌ Password must be at least 8 characters")
        sys.exit(1)
    
    success = test_reset(token, new_password)
    sys.exit(0 if success else 1)
