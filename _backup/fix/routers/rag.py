"""Fixed versions of the p2/routers/rag.py routes."""

from fastapi import APIRouter
from pydantic import BaseModel

from p2.deps import EmbedderDep, LLMManagerDep, VectorStoreDep

router = APIRouter(tags=["fixed"])

HIS_SYSTEM_PROMPT = (
    "answer the question based on the context provided, "
    "if the answer is not in the context, say 'I don't know'."
)


class RetrieveSourcesRequestDTO(BaseModel):
    query: str
    k: int = 5


class ScoredSourceDTO(BaseModel):
    file: str
    line: int
    score: float


class QueryAnswerDTO(BaseModel):
    response: str


@router.post("/retrieve", response_model=list[ScoredSourceDTO])
def retrieve_sources(
    request: RetrieveSourcesRequestDTO,
    store: VectorStoreDep,
    embedder: EmbedderDep,
) -> list[ScoredSourceDTO]:
    return [
        ScoredSourceDTO(file=chunk["file"], line=chunk["startLine"], score=round(chunk["rawDistance"], 2))
        for chunk in store.search_chunks(embedder.embed_one(request.query), request.k)
    ]


@router.get("/query", response_model=QueryAnswerDTO)
def query_rag(
    user_content: str,
    store: VectorStoreDep,
    embedder: EmbedderDep,
    llm: LLMManagerDep,
) -> QueryAnswerDTO:
    llm.ensure_pulled(llm.ask_model)

    documents = [chunk["content"] for chunk in store.search_chunks(embedder.embed_one(user_content))]
    messages = llm.build_messages(
        prompt=user_content,
        system_prompt=HIS_SYSTEM_PROMPT,
        context="\n\n".join(documents) if documents else None,
    )

    return QueryAnswerDTO(response="".join(llm.stream_answer(messages)))
