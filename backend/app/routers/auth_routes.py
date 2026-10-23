from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.core.supabase_client import get_supabase
from app.models.schemas import ProfileOut, RegisterRequest, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest):
    """
    Create a user via the service role with email already confirmed.
    No confirmation email is sent — avoids Supabase email rate limits in development.
    """
    email = payload.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email like name@gmail.com")

    supabase = get_supabase()
    try:
        result = supabase.auth.admin.create_user(
            {
                "email": email,
                "password": payload.password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": payload.full_name.strip(),
                    "role": payload.role.value,
                },
            }
        )
    except Exception as exc:
        message = str(exc)
        lowered = message.lower()
        if "already" in lowered or "registered" in lowered or "exists" in lowered:
            raise HTTPException(status_code=409, detail="An account with this email already exists. Sign in instead.") from exc
        if "rate" in lowered:
            raise HTTPException(
                status_code=429,
                detail="Auth rate limit hit. Wait a few minutes, or try a different email.",
            ) from exc
        raise HTTPException(status_code=400, detail=message) from exc

    user = result.user
    if not user:
        raise HTTPException(status_code=500, detail="User creation failed")

    # Ensure profile exists even if the DB trigger is not installed yet
    role = payload.role.value
    supabase.table("profiles").upsert(
        {
            "id": user.id,
            "email": email,
            "full_name": payload.full_name.strip() or email.split("@")[0],
            "role": role,
        }
    ).execute()

    return {"message": "Account created", "email": email, "role": role}

@router.post("/login")
async def login(payload: LoginRequest):
    email = str(payload.email).strip().lower()
    supabase = get_supabase()

    try:
        # Sign in with the user's email and password.
        result = supabase.auth.sign_in_with_password({
            "email": email,
            "password": payload.password,
        })
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not result.session or not result.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login failed. Check your credentials.",
        )

    return {
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
        "token_type": "bearer",
        "user": {
            "id": result.user.id,
            "email": result.user.email,
            "user_metadata": result.user.user_metadata or {},
        },
    }


@router.get("/me", response_model=ProfileOut)
async def me(user: Annotated[dict, Depends(get_current_user)]):
    return user
