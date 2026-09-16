from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from p3_beta.patch_loop import loop

router = APIRouter(tags=["/patch/loop"])


class PatchLoopInput(BaseModel):
    query: str
    k: int
    target_path: str | None
    ignored_paths: list[str]


class PatchFileDTO(BaseModel):
    path: str
    op: Literal["create", "modify", "delete"]
    content: str


class SanityDTO(BaseModel):
    code: int
    message: str


class PatchAttemptDTO(BaseModel):
    number: int
    summary: str
    files: list[PatchFileDTO]
    sanity: SanityDTO
    applied: bool
    validation_passed: bool
    validation_output: str


class PatchLoopOutputDTO(BaseModel):
    succeeded: bool
    attempts: list[PatchAttemptDTO]
    rolled_back: bool
    files_touched: list[str]
    summary: str


@router.post("/patch/loop", response_model=PatchLoopOutputDTO)
async def patch_loop(body: PatchLoopInput):
    try:
        return loop(
            query=body.query,
            k=body.k,
            target_path=body.target_path,
            ignored_paths=body.ignored_paths,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))