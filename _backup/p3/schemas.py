from typing import Literal

from pydantic import BaseModel, Field

from p2.schemas.chat import RetrievalRequestDTO


class PatchFileDTO(BaseModel):
    path: str = Field(min_length=1)
    op: Literal["create", "modify", "delete"]
    content: str = ""


class SanityResultDTO(BaseModel):
    code: int
    message: str


class ProposePatchRequestDTO(RetrievalRequestDTO):
    pass


class PatchProposalResponseDTO(BaseModel):
    summary: str
    files: list[PatchFileDTO]
    sanity: SanityResultDTO


class ApplyPatchRequestDTO(BaseModel):
    files: list[PatchFileDTO] = Field(min_length=1)
    ignoreNames: list[str] | None = None
    ignorePaths: list[str] | None = None


class ApplyPatchResponseDTO(BaseModel):
    applied: list[str]
    reindexed: int
    backupDir: str


class PatchAttemptDTO(BaseModel):
    number: int
    summary: str
    files: list[PatchFileDTO]
    sanity: SanityResultDTO
    applied: bool
    validationPassed: bool
    validationOutput: str


class PatchLoopRequestDTO(ProposePatchRequestDTO):
    targetPath: str | None = None


class PatchLoopResponseDTO(BaseModel):
    succeeded: bool
    attempts: list[PatchAttemptDTO]
    rolledBack: bool
    filesTouched: list[str]
    summary: str
