#!/usr/bin/env python3
"""Reset a user's password. Uses .env for DATABASE_URL."""

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(_root / ".env")
except Exception:
    pass

sys.path.insert(0, str(_root))

from src.auth_service import get_password_hash, get_user_by_email
from src.database import get_session_factory


def reset_admin_password(email: str, new_password: str) -> bool:
    """Reset password for user with the given email."""
    Session = get_session_factory()
    session = Session()
    try:
        user = get_user_by_email(session, email)
        if not user:
            print(f"User with email '{email}' not found.")
            return False
        user.password_hash = get_password_hash(new_password)
        session.commit()
        print(f"Password updated for '{email}' (id={user.id}, role={user.role}).")
        return True
    except Exception as e:
        session.rollback()
        print(f"Error: {e}", file=sys.stderr)
        raise
    finally:
        session.close()


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@pantry.com"
    password = sys.argv[2] if len(sys.argv) > 2 else "admin"
    ok = reset_admin_password(email, password)
    sys.exit(0 if ok else 1)
