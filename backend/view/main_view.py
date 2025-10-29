from fastapi import APIRouter


router = APIRouter(prefix="/view", tags=["view"])


@router.get("")
def index():
    return {"view": "This would serve rendered content in the future"}


