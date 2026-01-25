#!/usr/bin/env python3
"""
Create an admin account for the Smart Pantry application.

Usage:
    python scripts/create_admin.py
    python scripts/create_admin.py --email admin@example.com --password SecurePass123
    python scripts/create_admin.py --email admin@example.com --password SecurePass123 --name "Admin User"
"""

import argparse
import getpass
import sys
from pathlib import Path

# Ensure project root on path (script lives in scripts/)
_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

from src.auth_service import get_password_hash, get_user_by_email
from src.database import User, get_session_factory


def create_admin_account(email: str, password: str, full_name: str | None = None, yes: bool = False):
    """Create or update user to admin role."""
    Session = get_session_factory()
    session = Session()
    try:
        existing_user = get_user_by_email(session, email)
        if existing_user:
            if existing_user.role == "admin":
                print(f"✅ User '{email}' already exists as admin (ID: {existing_user.id}). Nothing to do.")
                return existing_user
            print(f"⚠️  User with email '{email}' already exists (ID: {existing_user.id}, Role: {existing_user.role})")
            if not yes:
                response = input("Update user to admin role? (y/n): ").strip().lower()
            else:
                response = "y"
            if response == "y":
                existing_user.role = "admin"
                if full_name:
                    existing_user.full_name = full_name
                if password:
                    existing_user.password_hash = get_password_hash(password)
                session.commit()
                print(f"✅ User '{email}' updated to admin role!")
                return existing_user
            print("❌ Aborted. User remains with current role.")
            return None

        user = User(
            email=email,
            password_hash=get_password_hash(password),
            full_name=full_name or "Admin User",
            role="admin",
            email_verified=True,
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        print(f"✅ Admin account created successfully!")
        print(f"   User ID: {user.id}  Email: {user.email}  Role: {user.role}")
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
    parser = argparse.ArgumentParser(description="Create an admin account")
    parser.add_argument("--email", type=str, help="Admin email")
    parser.add_argument("--password", type=str, help="Admin password")
    parser.add_argument("--name", type=str, help="Full name (optional)")
    parser.add_argument("--yes", "-y", action="store_true", help="Non-interactive; auto-confirm when user exists")
    args = parser.parse_args()

    email = args.email or input("Enter admin email: ").strip()
    if not email:
        print("❌ Email is required", file=sys.stderr)
        sys.exit(1)

    password = args.password
    if not password:
        password = getpass.getpass("Enter admin password (min 8 characters): ")
        if len(password) < 8:
            print("❌ Password must be at least 8 characters", file=sys.stderr)
            sys.exit(1)
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("❌ Passwords do not match", file=sys.stderr)
            sys.exit(1)

    full_name = args.name or input("Enter full name (optional, Enter to skip): ").strip() or None
    user = create_admin_account(email, password, full_name, yes=args.yes)
    sys.exit(0 if user else 1)


if __name__ == "__main__":
    main()
