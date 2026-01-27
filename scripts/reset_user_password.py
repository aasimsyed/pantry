#!/usr/bin/env python3
"""
Simple script to reset any user's password directly in the database.
Useful for development and when email is not configured.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.database import SessionLocal
from src.auth_service import get_password_hash
from src.database import User


def reset_password():
    """Reset a user's password."""
    print("=" * 60)
    print("Password Reset Tool")
    print("=" * 60)
    print()
    
    email = input("Enter user email: ").strip()
    if not email:
        print("❌ Email cannot be empty")
        sys.exit(1)
    
    new_password = input("Enter new password (min 8 chars): ").strip()
    if len(new_password) < 8:
        print("❌ Password must be at least 8 characters")
        sys.exit(1)
    
    confirm_password = input("Confirm new password: ").strip()
    if new_password != confirm_password:
        print("❌ Passwords do not match")
        sys.exit(1)
    
    # Connect to database
    db = SessionLocal()
    try:
        # Find user
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"❌ User not found: {email}")
            sys.exit(1)
        
        # Update password
        user.hashed_password = get_password_hash(new_password)
        db.commit()
        
        print()
        print(f"✅ Password successfully reset for: {email}")
        print(f"   User ID: {user.id}")
        print(f"   Role: {user.role}")
        print()
        print("You can now log in with the new password.")
        
    except Exception as e:
        print(f"❌ Error resetting password: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    reset_password()
