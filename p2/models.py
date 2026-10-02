# The two local models, through Ollama: one answers questions, one writes patches.
# The names come from the environment, so make install decides which ones fit the machine.
# The window can change them while the project runs, and the new names are written back
# to models.mk so the next run starts with them.

import os
from typing import Literal

import ollama
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from pydantic import BaseModel

from setup.ollama_models import MODELS as KNOWN_MODELS

ASK_MODEL = os.environ.get("ASK_MODEL", "qwen2.5:3b")
CODE_MODEL = os.environ.get("CODE_MODEL", "qwen2.5-coder:3b")
OLLAMA_URL = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
REPOSITORY_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_FILE = os.path.join(REPOSITORY_ROOT, "models.mk")
# Measured: without a limit, one answer took 7.8 of the 20 cores and the machine crawled.
MODEL_THREADS = int(os.environ.get("MODEL_THREADS", max(2, (os.cpu_count() or 4) // 3)))
# Seen: a 3B model writing a patch can loop and never stop, the CPU flat out for minutes.
# A patch holds at most the 6000 characters of p3's context, about 2000 tokens: past that,
# the answer is cut, cannot be read, and the loop goes on to its next attempt.
PATCH_MAX_TOKENS = 2048
ANSWER_MAX_TOKENS = 1024

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


def is_installed(name, installed):
    for installed_name in installed:
        if installed_name in (name, name + ":latest"):
            return True
    return False


def missing_models():
    installed = installed_models()
    missing = []
    for name in {ASK_MODEL, CODE_MODEL}:
        if not any(name in (installed_name or "") for installed_name in installed):
            missing.append(name)
    return sorted(missing)


def model_choices():
    # Every model the window can offer: the ones Ollama already has, and the ones of the
    # picker of make install, which still have to be pulled.
    installed = installed_models()
    choices = []
    for model in KNOWN_MODELS:
        choices.append(
            {
                "name": model["name"],
                "installed": is_installed(model["name"], installed),
                "download_gib": model["download_gib"],
                "ram_gib": model["ram_gib"],
            }
        )

    known_names = [model["name"] for model in KNOWN_MODELS]
    for name in installed:
        if name not in known_names and name.removesuffix(":latest") not in known_names:
            choices.append(
                {"name": name, "installed": True, "download_gib": None, "ram_gib": None}
            )
    return choices


def write_models_file():
    with open(MODELS_FILE, "w", encoding="utf-8") as file:
        file.write("# written by make install-models, and by the model picker of the window\n")
        file.write(f"ASK_MODEL := {ASK_MODEL}\n")
        file.write(f"CODE_MODEL := {CODE_MODEL}\n")


def use_models(ask_model=None, code_model=None):
    # The answer and the patch read ASK_MODEL and CODE_MODEL at every call, so a name
    # changed here is used by the next question, with nothing to restart.
    global ASK_MODEL, CODE_MODEL

    installed = installed_models()
    for name in [ask_model, code_model]:
        if name is not None and not is_installed(name, installed):
            raise ValueError(f"{name} is not pulled yet")

    if ask_model is not None:
        ASK_MODEL = ask_model
    if code_model is not None:
        CODE_MODEL = code_model
    write_models_file()


def pull_model(name):
    if not any(choice["name"] == name for choice in model_choices()):
        raise ValueError(f"{name} is not a model this project offers")

    for progress in ollama.pull(name, stream=True):
        yield {
            "status": progress.get("status") or "",
            "completed": progress.get("completed") or 0,
            "total": progress.get("total") or 0,
        }


def chat_model(name, temperature, max_tokens):
    key = (name, temperature, max_tokens)
    if key not in chat_models:
        chat_models[key] = ChatOllama(
            model=name, temperature=temperature, num_thread=MODEL_THREADS, num_predict=max_tokens
        )
    return chat_models[key]


def stream_answer(question, context, history):
    messages = [SystemMessage(content=ANSWER_RULES)]
    for role, content in history:
        messages.append(HumanMessage(content=f"{role}: {content}"))
    messages.append(HumanMessage(content=f"Code:\n{context}\n\nQuestion: {question}"))

    for piece in chat_model(ASK_MODEL, 0.2, ANSWER_MAX_TOKENS).stream(messages):
        if piece.content:
            yield piece.content


def generate_patch(prompt):
    answer = (
        chat_model(CODE_MODEL, 0.0, PATCH_MAX_TOKENS)
        .with_structured_output(CodePatch)
        .invoke([HumanMessage(content=prompt)])
    )
    if not isinstance(answer, CodePatch):
        raise ValueError("the model did not answer a patch with a summary and files")
    return answer
