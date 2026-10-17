from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.models.schemas import ProfileOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=ProfileOut)
async def me(user: Annotated[dict, Depends(get_current_user)]):
    return user
