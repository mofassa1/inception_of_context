import sys
import logging
import ollama
from langchain_ollama import ChatOllama
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from p1.general_infos_object import g_infos
logger = logging.getLogger(__name__)

from pydantic import BaseModel
from typing import Literal, cast


class PatchFile(BaseModel):
    path: str
    op: Literal["create", "modify", "delete", "noop"]
    content: str = ""


class CodePatch(BaseModel):
    summary: str
    files: list[PatchFile]

class OllamaModelManager:
    def __init__(self, model_name: str, code_model_name: str = "qwen2.5-coder:3b"):
        self.model_name = model_name
        self._llm: ChatOllama | None = None
        self._code_llm: ChatOllama | None = None
        self.code_model_name = code_model_name
        g_infos.set_llm_name(self.model_name)
        g_infos.set_code_llm_name(self.code_model_name)

    def get_code_model_name(self) -> str:
        """Return the name of the code model."""
        return self.code_model_name
    
    def get_model_name(self) -> str:
        """Return the name of the main model."""
        return self.model_name

    def ensure_model_exists(self) -> None:
        """Check if the Ollama model exists locally; if not, pull it."""
        try:
            response = ollama.list()
            local_models = []
            for m in response.get("models", []):
                if isinstance(m, dict):
                    local_models.append(m.get("model") or m.get("name"))
                else:
                    local_models.append(getattr(m, "model", getattr(m, "name", "")))

            check_name = self.model_name if ":" in self.model_name else f"{self.model_name}:latest"

            if not any(check_name in m for m in local_models if m):
                logger.info(f"Model '{self.model_name}' not found locally. Pulling...")
                ollama.pull(self.model_name)
                logger.info(f"Model '{self.model_name}' successfully downloaded.")

        except Exception as e:
            raise RuntimeError(
                f"Error connecting to local Ollama server: {e}. "
                "Make sure the Ollama service is running."
            ) from e

    def get_chat_model(self) -> ChatOllama:
        """Return a cached ChatOllama instance, creating it once."""
        if self._llm is None:
            self._llm = ChatOllama(model=self.model_name)
        return self._llm

    def build_messages(
        self,
        prompt: str,
        system_prompt: str | None = None,
        context: str | None = None,
        history: list[BaseMessage] | None = None,
    ) -> list[BaseMessage]:
        """Assemble the message list: system instructions + context + history + question."""
        messages: list[BaseMessage] = []

        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))

        if history:
            messages.extend(history)

        if context:
            # Keep retrieval context distinct from the raw question
            user_content = f"Context:\n{context}\n\nQuestion: {prompt}"
        else:
            user_content = prompt

        messages.append(HumanMessage(content=user_content))
        return messages

    def stream_response(self, messages: list[BaseMessage]):
        """Stream the response from the model for a given message list."""
        llm = self.get_chat_model()
        for chunk in llm.stream(messages):
            if chunk.content:
                yield chunk.content
                
################################################
    def ensure_code_model_exists(self) -> None:
        """Check if the code model exists locally; if not, pull it."""
        try:
            response = ollama.list()
            local_models = []
            for m in response.get("models", []):
                if isinstance(m, dict):
                    local_models.append(m.get("model") or m.get("name"))
                else:
                    local_models.append(getattr(m, "model", getattr(m, "name", "")))

            check_name = self.code_model_name if ":" in self.code_model_name else f"{self.code_model_name}:latest"

            if not any(check_name in m for m in local_models if m):
                logger.info(f"Code model '{self.code_model_name}' not found locally. Pulling...")
                ollama.pull(self.code_model_name)
                logger.info(f"Code model '{self.code_model_name}' successfully downloaded.")

        except Exception as e:
            raise RuntimeError(
                f"Error connecting to local Ollama server: {e}. "
                "Make sure the Ollama service is running."
            ) from e
        

    def get_code_model(self) -> ChatOllama:
        """Return a cached ChatOllama instance for the code model, creating it once."""
        if self._code_llm is None:
            self._code_llm = ChatOllama(model=self.code_model_name, temperature=0.0)
        return self._code_llm

    def generate_code_response(
        self,
        messages: list[BaseMessage],
    ) -> CodePatch:

        llm = self.get_code_model()

        structured_llm = llm.with_structured_output(CodePatch)

        result =structured_llm.invoke(messages)
        return cast(CodePatch, result)