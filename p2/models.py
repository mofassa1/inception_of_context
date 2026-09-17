# The two local models, through Ollama: one answers questions, one writes patches.
# The names come from the environment, so make install decides which ones fit the machine.

import os
from typing import Literal

import ollama
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from pydantic import BaseModel

ASK_MODEL = os.environ.get("ASK_MODEL", "qwen2.5:3b")
CODE_MODEL = os.environ.get("CODE_MODEL", "qwen2.5-coder:3b")
OLLAMA_URL = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")

ANSWER_RULES = (
    "You answer questions about a code project. Use the code given as context. "
    "If the context does not hold the answer, say so instead of inventing one. "
    "Answer in a few sentences, and name the file you are talking about."
)

chat_models = {}


class PatchFile(BaseModel):
    path: str
    op: Literal["create", "modify", "delete", "noop"]
    content: str = ""


class CodePatch(BaseModel):
    summary: str
    files: list[PatchFile]


def installed_models():
    return [model.get("model") or model.get("name") for model in ollama.list().get("models", [])]


def missing_models():
    installed = installed_models()
    missing = []
    for name in {ASK_MODEL, CODE_MODEL}:
        if not any(name in (installed_name or "") for installed_name in installed):
            missing.append(name)
    return sorted(missing)


def chat_model(name, temperature):
    if name not in chat_models:
        chat_models[name] = ChatOllama(model=name, temperature=temperature)
    return chat_models[name]


def stream_answer(question, context, history):
    messages = [SystemMessage(content=ANSWER_RULES)]
    for role, content in history:
        messages.append(HumanMessage(content=f"{role}: {content}"))
    messages.append(HumanMessage(content=f"Code:\n{context}\n\nQuestion: {question}"))

    for piece in chat_model(ASK_MODEL, 0.2).stream(messages):
        if piece.content:
            yield piece.content


def generate_patch(prompt):
    answer = (
        chat_model(CODE_MODEL, 0.0)
        .with_structured_output(CodePatch)
        .invoke([HumanMessage(content=prompt)])
    )
    if not isinstance(answer, CodePatch):
        raise ValueError("the model did not answer a patch with a summary and files")
    return answer
