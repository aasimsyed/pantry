"""Rate limiter and key function for SlowAPI."""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from src.auth_service import verify_token


def get_user_id_for_rate_limit(request: Request) -> str:
    """
    Rate limit key: user ID if authenticated, else IP.
    """
    try:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            payload = verify_token(token, token_type="access")
            user_id = payload.get("sub")
            if user_id:
                return f"user:{user_id}"
    except Exception:
        pass
    return get_remote_address(request)


limiter = Limiter(key_func=get_user_id_for_rate_limit)
