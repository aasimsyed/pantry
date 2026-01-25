#!/usr/bin/env python3
"""
Create an admin account for the Smart Pantry application.

Usage:
    python3 create_admin.py
    python3 create_admin.py --email admin@example.com --password SecurePass123
    python3 create_admin.py --email admin@example.com --password SecurePass123 --name "Admin User"
"""

import sys
import os
import getpass
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from src.database import get_session_factory, User
from src.auth_service import get_password_hash, get_user_by_email
import argparse


def create_admin_account(email: str, password: str, full_name: str = None):
    """Create an admin account.
    
    Args:
        email: Admin email address
        password: Admin password
        full_name: Optional full name
    """
    # Get database session
    Session = get_session_factory()
    session = Session()
    
    try:
        # Check if user already exists
        existing_user = get_user_by_email(session, email)
        if existing_user:
            print(f"⚠️  User with email '{email}' already exists (ID: {existing_user.id}, Role: {existing_user.role})")
            
            # Ask if we should update to admin
            response = input(f"Update user to admin role? (y/n): ").strip().lower()
            if response == 'y':
                existing_user.role = "admin"
                if full_name:
                    existing_user.full_name = full_name
                # Update password if provided
                if password:
                    existing_user.password_hash = get_password_hash(password)
                session.commit()
                print(f"✅ User '{email}' updated to admin role!")
                print(f"   User ID: {existing_user.id}")
                print(f"   Email: {existing_user.email}")
                print(f"   Role: {existing_user.role}")
                return existing_user
            else:
                print("❌ Aborted. User remains with current role.")
                return None
        
        # Create new admin user
        user = User(
            email=email,
            password_hash=get_password_hash(password),
            full_name=full_name or "Admin User",
            role="admin",
            email_verified=True,
            is_active=True
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        
        print(f"✅ Admin account created successfully!")
        print(f"   User ID: {user.id}")
        print(f"   Email: {user.email}")
        print(f"   Full Name: {user.full_name}")
        print(f"   Role: {user.role}")
        print()
        print(f"📝 You can now log in with:")
        print(f"   Email: {email}")
        print(f"   Password: {'*' * len(password)}")
        
        return user
        
    except Exception as e:
        session.rollback()
        print(f"❌ Error creating admin account: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return None
    finally:
        session.close()


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Create an admin account")
    parser.add_argument("--email", type=str, help="Admin email address")
    parser.add_argument("--password", type=str, help="Admin password")
    parser.add_argument("--name", type=str, help="Full name (optional)")
    
    args = parser.parse_args()
    
    # Get email
    email = args.email
    if not email:
        email = input("Enter admin email: ").strip()
        if not email:
            print("❌ Email is required", file=sys.stderr)
            sys.exit(1)
    
    # Get password
    password = args.password
    if not password:
        password = getpass.getpass("Enter admin password (min 8 characters): ")
        if len(password) < 8:
            print("❌ Password must be at least 8 characters", file=sys.stderr)
            sys.exit(1)
        
        confirm_password = getpass.getpass("Confirm password: ")
        if password != confirm_password:
            print("❌ Passwords do not match", file=sys.stderr)
            sys.exit(1)
    
    # Get full name
    full_name = args.name
    if not full_name:
        full_name = input("Enter full name (optional, press Enter to skip): ").strip()
        if not full_name:
            full_name = None
    
    # Create admin account
    user = create_admin_account(email, password, full_name)
    
    if user:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
