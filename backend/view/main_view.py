"""Placeholder routes for future server-rendered views."""

from fastapi import APIRouter


router = APIRouter(prefix="/view", tags=["view"])


@router.get("")
def index():
    """Stub endpoint reserved for HTML or other rendered responses."""
    return {"view": "This would serve rendered content in the future"}


