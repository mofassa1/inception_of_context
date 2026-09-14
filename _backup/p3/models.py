from typing import Literal

from pydantic import BaseModel


class PatchFile(BaseModel):
    path: str
    op: Literal["create", "modify", "delete", "noop"]
    content: str = ""


class CodePatch(BaseModel):
    summary: str
    files: list[PatchFile]
