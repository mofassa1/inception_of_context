from typing import cast

import ollama
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_ollama import ChatOllama

from p1.core.errors import ModelUnavailable, OllamaUnreachable
from p1.core.logging import get_logger
from p3.models import CodePatch

logger = get_logger(__name__)

HISTORY_MAX_MESSAGES = 6
HISTORY_MAX_CHARS = 4000


def trim_history(turns: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """Keep the most recent turns within both a count and a character budget,
    so conversation memory never crowds out retrieved code."""
    recent = turns[-HISTORY_MAX_MESSAGES:]

    kept: list[tuple[str, str]] = []
    budget = HISTORY_MAX_CHARS

    for role, content in reversed(recent):
        cost = len(content)
        if cost > budget:
            break
        budget -= cost
        kept.append((role, content))

    return list(reversed(kept))


class OllamaModelManager:
    def __init__(
        self,
        ask_model: str,
        code_model: str,
        ollama_host: str,
        auto_pull: bool = False,
    ):
        self.ask_model = ask_model
        self.code_model = code_model
        self.ollama_host = ollama_host

        self._chat_llm: ChatOllama | None = None
        self._code_llm: ChatOllama | None = None
        self._verified: set[str] = set()
        self._auto_pull = auto_pull

    def _installed_models(self) -> list[str]:
        try:
            response = ollama.list()
        except Exception as error:
            raise OllamaUnreachable(
                f"Cannot reach the Ollama server at {self.ollama_host}: {error}. "
                "Make sure the Ollama service is running."
            ) from error

        names = []
        for entry in response.get("models", []):
            if isinstance(entry, dict):
                names.append(entry.get("model") or entry.get("name"))
            else:
                names.append(getattr(entry, "model", getattr(entry, "name", "")))

        return [name for name in names if name]

    def ensure_pulled(self, model_name: str) -> None:
        """Verify a model is present. Never blocks a request on a multi-GB pull
        unless IOC_AUTO_PULL=1 is set explicitly."""
        if model_name in self._verified:
            return

        installed = self._installed_models()
        expected = model_name if ":" in model_name else f"{model_name}:latest"

        if any(expected in name for name in installed):
            self._verified.add(model_name)
            return

        if self._auto_pull:
            logger.info("Pulling '%s'...", model_name)
            ollama.pull(model_name)
            self._verified.add(model_name)
            return

        raise ModelUnavailable(
            f"Model '{model_name}' is not installed. "
            f"Run: ollama pull {model_name}"
            + (f" (installed: {', '.join(installed)})" if installed else "")
        )

    def chat_model(self) -> ChatOllama:
        self.ensure_pulled(self.ask_model)
        if self._chat_llm is None:
            self._chat_llm = ChatOllama(model=self.ask_model)
        return self._chat_llm

    def coding_model(self) -> ChatOllama:
        self.ensure_pulled(self.code_model)
        if self._code_llm is None:
            self._code_llm = ChatOllama(model=self.code_model, temperature=0.0)
        return self._code_llm

    def build_messages(
        self,
        prompt: str,
        system_prompt: str | None = None,
        context: str | None = None,
        history: list[tuple[str, str]] | None = None,
    ) -> list[BaseMessage]:
        messages: list[BaseMessage] = []

        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))

        for role, content in trim_history(history or []):
            if role == "assistant":
                messages.append(AIMessage(content=content))
            else:
                messages.append(HumanMessage(content=content))

        if context:
            messages.append(
                HumanMessage(content=f"Context:\n{context}\n\nQuestion: {prompt}")
            )
        else:
            messages.append(HumanMessage(content=prompt))

        return messages

    def stream_answer(self, messages: list[BaseMessage]):
        for chunk in self.chat_model().stream(messages):
            if chunk.content:
                yield chunk.content

    def generate_patch(self, messages: list[BaseMessage]) -> CodePatch:
        structured = self.coding_model().with_structured_output(CodePatch)
        return cast(CodePatch, structured.invoke(messages))
