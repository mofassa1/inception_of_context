from fastapi import APIRouter, HTTPException
from p2.store import vector_store as store
from p2.llm_object import llm_manager
from p2.embidder_object import embedder

router = APIRouter(tags=["rag"])

@router.get("/query")
async def query_rag(user_content: str):
    try:
        # Ensure the model exists before querying
        llm_manager.ensure_model_exists()

        # Get the relevant chunks from the vector store
        query_embedding = embedder.create_embeddings([user_content])
        print("+" * 20)
        print("Query embedding check: type and shape")
        print(type(query_embedding))
        print(len(query_embedding))
        print("+" * 20)
        relevant_chunks = store.cosine_similarity_search(query_embedding)

        # Prepare messages for the RAG model
        messages = llm_manager.build_messages(
            system_prompt="answer the question based on the context provided, if the answer is not in the context, say 'I don't know'.",
            prompt=user_content,
            context="\n\n".join(relevant_chunks) if relevant_chunks else None
        )
        # messages = llm_manager.prepare_messages(relevant_chunks, user_content)

        # Stream the response from the model
        response_stream = llm_manager.stream_response(messages)

        return {"response": response_stream}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel


class RetrieveRequest(BaseModel):
    query: str
    k: int = 5


@router.post("/retrieve")
async def retrieve_sources(request: RetrieveRequest):
    query = request.query
    k = request.k

    try:
        # Ensure the model exists before retrieving sources
        llm_manager.ensure_model_exists()

        # Get the relevant chunks from the vector store
        query_embedding = embedder.create_embeddings([query])
        relevant_chunks = store.cosine_similarity_search_with_scores( query_embedding=query_embedding[0], n_results=k)

        return relevant_chunks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AskRequest(BaseModel):
    query: str
    k: int = 5
    session_id: str = ""

from fastapi.responses import StreamingResponse

@router.post("/ask/stream")
async def ask_stream(request: AskRequest):
    user_content = request.query
    k = request.k
    session_id = request.session_id
    try:
        llm_manager.ensure_model_exists()

        query_embedding = embedder.create_embeddings([user_content])
        relevant_chunks = store.cosine_similarity_search(query_embedding[0], n_results=k)

        messages = llm_manager.build_messages(
            system_prompt="answer the question based on the context provided, if the answer is not in the context, say 'I don't know'.",
            prompt=user_content,
            context="\n\n".join(relevant_chunks) if relevant_chunks else None
        )

        response_stream = llm_manager.stream_response(messages)

        return StreamingResponse(response_stream, media_type="text/plain")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))