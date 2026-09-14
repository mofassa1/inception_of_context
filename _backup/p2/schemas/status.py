from pydantic import BaseModel

from p2.schemas.files import IndexedFileDTO


class EventBusStatsDTO(BaseModel):
    subscribers: int
    droppedEvents: int
    queueCapacity: int


class AgentStatusDTO(BaseModel):
    chunksIndexed: int
    targetProject: str
    chromaPath: str
    askModel: str
    codeModel: str
    embedModel: str
    ollamaBackend: str
    watching: bool
    events: EventBusStatsDTO


class StatusResponseDTO(BaseModel):
    status: AgentStatusDTO
    files: list[IndexedFileDTO]
    filesIndexed: int
