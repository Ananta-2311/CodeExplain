"""Placeholder routes for future server-rendered views.

Reserved for SSR or auxiliary JSON/HTML endpoints. The main product UI is
the React app; this router is mounted for forward compatibility.
"""

from fastapi import APIRouter


router = APIRouter(prefix="/view", tags=["view"])


@router.get("")
def index():
    """Return a placeholder JSON body until a real template or redirect is wired in."""
    return {"view": "This would serve rendered content in the future"}


