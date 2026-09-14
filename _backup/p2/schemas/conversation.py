from pydantic import BaseModel, Field

from p2.schemas.chat import AnswerSourceDTO


class ConversationTurnDTO(BaseModel):
    role: str
    content: str
    mode: str = "ask"
    at: float = 0.0
    sources: list[AnswerSourceDTO] | None = None


class ConversationSummaryDTO(BaseModel):
    id: str
    title: str
    updatedAt: float
    messageCount: int


class ConversationListResponseDTO(BaseModel):
    conversations: list[ConversationSummaryDTO]


class ConversationResponseDTO(BaseModel):
    id: str
    title: str
    createdAt: float
    updatedAt: float
    turns: list[ConversationTurnDTO]


class AppendTurnsRequestDTO(BaseModel):
    turns: list[ConversationTurnDTO] = Field(min_length=1)
