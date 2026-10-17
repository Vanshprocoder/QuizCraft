from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.supabase_client import get_supabase

security = HTTPBearer(auto_error=False)


def _decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        if settings.supabase_jwt_secret:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        # Fallback: validate via Supabase Auth API
        user_resp = get_supabase().auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {
            "sub": user_resp.user.id,
            "email": user_resp.user.email,
            "role": (user_resp.user.user_metadata or {}).get("role", "student"),
        }
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc


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

    if not profile.data:
        # Auto-provision profile from JWT claims on first API call
        email = payload.get("email") or ""
        role = payload.get("user_metadata", {}).get("role") if isinstance(payload.get("user_metadata"), dict) else None
        role = role or payload.get("role") or "student"
        inserted = (
            supabase.table("profiles")
            .upsert(
                {
                    "id": user_id,
                    "email": email,
                    "full_name": email.split("@")[0] if email else "User",
                    "role": role if role in ("teacher", "student") else "student",
                }
            )
            .execute()
        )
        if not inserted.data:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Profile not found")
        return inserted.data[0] if isinstance(inserted.data, list) else inserted.data

    return profile.data


def require_role(*roles: str):
    async def checker(user: Annotated[dict[str, Any], Depends(get_current_user)]) -> dict[str, Any]:
        if user.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return checker
