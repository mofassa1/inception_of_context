from fastapi import APIRouter

from p2.deps import ConversationStoreDep
from p2.conversation import ConversationTurn
from p2.schemas.conversation import (
    AppendTurnsRequestDTO,
    ConversationListResponseDTO,
    ConversationResponseDTO,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=ConversationListResponseDTO)
def list_conversations(store: ConversationStoreDep) -> ConversationListResponseDTO:
    return ConversationListResponseDTO(conversations=store.list_summaries())


@router.post("", response_model=ConversationResponseDTO)
def create_conversation(store: ConversationStoreDep) -> ConversationResponseDTO:
    return ConversationResponseDTO(**store.create().to_dict())


@router.get("/{conversation_id}", response_model=ConversationResponseDTO)
def get_conversation(
    conversation_id: str, store: ConversationStoreDep
) -> ConversationResponseDTO:
    return ConversationResponseDTO(**store.get(conversation_id).to_dict())


@router.patch("/{conversation_id}", response_model=ConversationResponseDTO)
def append_turns(
    conversation_id: str,
    request: AppendTurnsRequestDTO,
    store: ConversationStoreDep,
) -> ConversationResponseDTO:
    turns = [
        ConversationTurn(
            role=turn.role,
            content=turn.content,
            mode=turn.mode,
            sources=(
                [source.model_dump() for source in turn.sources]
                if turn.sources is not None
                else None
            ),
        )
        for turn in request.turns
    ]
    return ConversationResponseDTO(**store.append(conversation_id, turns).to_dict())


@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: str, store: ConversationStoreDep) -> dict:
    store.delete(conversation_id)
    return {"ok": True}
