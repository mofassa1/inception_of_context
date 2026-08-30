import os

from .llm_manager import OllamaModelManager

llm_manager = OllamaModelManager(
    model_name=os.getenv("ASK_MODEL", "qwen2.5:3b"),
    code_model_name=os.getenv("CODE_MODEL", "qwen2.5-coder:3b"),
)
