from fastapi import APIRouter
from pydantic import BaseModel
from model.parser_model import ParserModel


router = APIRouter(prefix="/explain", tags=["explain"])


class ExplainRequest(BaseModel):
    code: str


@router.post("")
def explain(req: ExplainRequest):
    parser = ParserModel()
    parsed = parser.parse(req.code)
    return {"message": "Explanation not yet implemented", "parsed": parsed}


