from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from uuid import uuid4

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.supabase_client import get_supabase

security = HTTPBearer(auto_error=False)


def create_access_token(*, user_id: str, email: str, role: str) -> str:
    settings = get_settings()
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, settings.app_jwt_secret, algorithm="HS256")


# def _decode_token(token: str) -> dict[str, Any]:
#     settings = get_settings()
#     try:
#         return jwt.decode(token, settings.app_jwt_secret, algorithms=["HS256"])
#     except JWTError as exc:
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


def _decode_token(token: str) -> dict[str, Any]:
    try:
        user_resp = get_supabase().auth.get_user(token)
        user = user_resp.user

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        metadata = user.user_metadata or {}

        return {
            "sub": user.id,
            "email": user.email or "",
            "user_metadata": metadata,
            "role": metadata.get("role", "student"),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> dict[str, Any]:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    payload = _decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    supabase = get_supabase()
    profile = (
        supabase.table("profiles")
        .select("id, email, full_name, role")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )

    if profile.data:
        return profile.data

    # Fallback from token claims if profile row is missing
    return {
        "id": user_id,
        "email": payload.get("email") or "",
        "full_name": (payload.get("email") or "User").split("@")[0],
        "role": payload.get("role") or "student",
    }


def require_role(*roles: str):
    async def checker(user: Annotated[dict[str, Any], Depends(get_current_user)]) -> dict[str, Any]:
        if user.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return checker


def new_user_id() -> str:
    return str(uuid4())
