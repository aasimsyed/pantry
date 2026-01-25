"""
API configuration – re-exports centralized settings.

All env-backed config lives in src.config. This module exposes it as `config`
for backward compatibility (main.py, etc.).
"""

from src.config import settings

config = settings
