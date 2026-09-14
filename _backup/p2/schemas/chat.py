from typing import Literal

from pydantic import BaseModel, Field


class RetrievalRequestDTO(BaseModel):
    query: str = Field(min_length=1)
    k: int = Field(default=5, ge=1, le=50)
    conversationId: str | None = None


class AskRequestDTO(RetrievalRequestDTO):
    pass


class RetrieveRequestDTO(RetrievalRequestDTO):
    pass


class RetrievedSourceDTO(BaseModel):
    file: str
    line: int
    kind: str
    qualifiedName: str
    distance: float


class RetrieveResponseDTO(BaseModel):
    sources: list[RetrievedSourceDTO]


class AnswerSourceDTO(BaseModel):
    rank: int
    id: str
    file: str
    startLine: int
    endLine: int
    kind: str
    qualifiedName: str
    distance: float
    content: str


class AskSourcesLineDTO(BaseModel):
    type: Literal["sources"] = "sources"
    sources: list[AnswerSourceDTO]


class AskTokenLineDTO(BaseModel):
    type: Literal["token"] = "token"
    text: str
