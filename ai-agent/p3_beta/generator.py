from p2.llm_object import llm_manager
from p2.embidder_object import embedder
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from p2.llm_manager import CodePatch, PatchFile
from p2.store import vector_store as store

def build_prompt_template(query: str, file_paths: list[str], context: str) -> str:
    """Build the prompt template for the code model."""
    return prompt_template.format(
        query=query,
        file_paths="\n".join(file_paths),
        context=context
    )

prompt_template = """
You are a coding agent responsible for proposing changes to an existing codebase.

Your task is to modify the codebase according to the user's request.

USER REQUEST:
{query}

AVAILABLE FILES:
{file_paths}

RELEVANT CODE CONTEXT:
{context}

RULES:

1. Only modify files whose paths appear in AVAILABLE FILES.
2. For each file, choose exactly one operation:
   - "create": create a new file. Use this only if the file does not already exist.
   - "modify": modify an existing file.
   - "delete": delete an existing file.
3. For "modify", provide the COMPLETE resulting content of the file.
   Do NOT provide a diff, patch, or only the changed lines.
4. For "create", provide the COMPLETE content of the new file.
5. For "delete", no file content is required.
6. Do not modify files that are unrelated to the user's request.
7. Do not invent file paths. Use paths exactly as they appear in AVAILABLE FILES.
8. Preserve the existing code's structure and behavior unless the user's request requires changing it.
9. Do not return explanations, markdown, diffs, or code fences outside the structured response.
10. Make the smallest reasonable change that satisfies the user's request.
11. If the request cannot be safely implemented from the provided context, do not invent missing code or files.
12. Determine whether the user's request actually requires modifying the codebase.
13. If the user's request is a question, explanation, review, feedback,
    or any other request that does NOT require a code change:
    - Do not create, modify, or delete any files.
    - Use "noop" as the operation.
    - Set "content" to an empty string.
    - Put the answer, explanation, or feedback in the "summary" field.
    - The summary should directly answer the user's request.
14. If the request requires code changes:
    - Use "create", "modify", or "delete" as appropriate.
    - Do not use "noop".
    - The summary should briefly describe the proposed changes.
15. For a "noop" operation, the file path is not relevant and should not
    refer to a file that is being modified.
IMPORTANT:
- The response will be parsed as a structured CodePatch object.
- The summary should briefly describe the proposed changes.
- Each file entry must contain its path, operation, and resulting content when applicable.
"""

def generate_code_response(messages: list[BaseMessage]) -> CodePatch:
    """Generate a code response using the code model."""
    return llm_manager.generate_code_response(messages)
    
def answer_user_query(message: str) -> CodePatch:

    message_embedding = embedder.create_embeddings([message])
    top_k_chunks = store.cosine_similarity_search(query_embedding=message_embedding[0], n_results=5)
    prompt = build_prompt_template(query=message, file_paths=store.get_all_files(), context="\n\n".join(top_k_chunks))
    return generate_code_response([HumanMessage(content=prompt)])

