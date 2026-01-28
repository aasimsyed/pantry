#!/usr/bin/env python3
"""
List all users in the Smart Pantry database.

Usage:
    python scripts/list_users.py
    python -m scripts.list_users
"""

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

from src.database import User, get_db_session


def main():
    """List all users (id, email, full_name, role, is_active, created_at)."""
    session = get_db_session()
    try:
        users = session.query(User).order_by(User.id).all()
        print("=" * 70)
        print("USERS IN DATABASE")
        print("=" * 70)
        if not users:
            print("(no users)")
            return
        for u in users:
            name = (u.full_name or "").strip() or "-"
            print(f"  id: {u.id}")
            print(f"  email: {u.email}")
            print(f"  full_name: {name}")
            print(f"  role: {u.role}")
            print(f"  is_active: {u.is_active}")
            print(f"  created_at: {u.created_at}")
            if u.last_login:
                print(f"  last_login: {u.last_login}")
            print("-" * 70)
        print(f"Total: {len(users)} user(s)")
    finally:
        session.close()


if __name__ == "__main__":
    main()
