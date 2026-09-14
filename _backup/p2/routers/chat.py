from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from p2.deps import (
    ConversationStoreDep,
    EmbedderDep,
    LLMManagerDep,
    RetrievalServiceDep,
    VectorStoreDep,
)
from p2.schemas.chat import (
    AnswerSourceDTO,
    AskRequestDTO,
    AskSourcesLineDTO,
    AskTokenLineDTO,
    RetrieveRequestDTO,
    RetrieveResponseDTO,
)

router = APIRouter(tags=["chat"])

SYSTEM_PROMPT = """You are a coding assistant for the project the user has open.

If the user greets you, thanks you, or asks something that is not about the
code, just reply naturally in one short sentence. Do not mention the context,
do not ask them to rephrase, and do not say you don't know. "hello" is answered
with a greeting.

For questions about the code:
- Context blocks are numbered and headed by file, line range and symbol, for
  example `[2] ─── notes/service.py · lines 7-13 · function NoteService.create`.
  [1] is the most relevant block.
- Answer only from those blocks. Never name a function, class or file that does
  not appear in them.
- Name the file you took your answer from.
- If the context genuinely lacks the answer, say so and name what you would need
  to see.
- End with one line listing the blocks you relied on, for example
  `Chunks used: [1], [3]`."""


def answer_lines(sources: list[AnswerSourceDTO], tokens):
    """NDJSON: the chunks the answer is built from, then the answer itself.

    The sources go first and are exactly what the prompt was given, so the
    dashboard can show them before a slow model has produced a word.
    """
    yield AskSourcesLineDTO(sources=sources).model_dump_json() + "\n"

    for text in tokens:
        yield AskTokenLineDTO(text=text).model_dump_json() + "\n"


@router.post("/context", response_model=RetrieveResponseDTO)
def retrieve_context(
    request: RetrieveRequestDTO,
    embedder: EmbedderDep,
    store: VectorStoreDep,
) -> RetrieveResponseDTO:
    query_embedding = embedder.embed_one(request.query)
    return RetrieveResponseDTO(
        sources=store.search_with_scores(query_embedding, n_results=request.k)
    )


@router.post("/ask")
def ask(
    request: AskRequestDTO,
    llm: LLMManagerDep,
    retrieval: RetrievalServiceDep,
    conversations: ConversationStoreDep,
) -> StreamingResponse:
    llm.ensure_pulled(llm.ask_model)

    chunks = retrieval.collect(request.query, request.k)
    context = retrieval.render_context(chunks)

    messages = llm.build_messages(
        prompt=request.query,
        system_prompt=SYSTEM_PROMPT,
        context="\n\n".join(context) if context else None,
        history=conversations.history(request.conversationId),
    )

    sources = [
        AnswerSourceDTO(
            rank=chunk["rank"],
            id=chunk["id"],
            file=chunk["file"],
            startLine=chunk["startLine"],
            endLine=chunk["endLine"],
            kind=chunk["kind"],
            qualifiedName=chunk["qualifiedName"],
            distance=round(chunk["distance"], 4),
            content=chunk["content"],
        )
        for chunk in chunks
    ]

    return StreamingResponse(
        answer_lines(sources, llm.stream_answer(messages)),
        media_type="application/x-ndjson",
    )
