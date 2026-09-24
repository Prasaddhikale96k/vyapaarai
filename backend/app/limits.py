"""Shared slowapi limiter (imported by routers; main.py attaches it to app.state)."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])
