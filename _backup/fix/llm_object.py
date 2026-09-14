"""Reads the model names from p2/llm_object.py."""


def model_names() -> tuple[str, str]:
    from p2.llm_object import llm_manager

    return llm_manager.get_model_name(), llm_manager.get_code_model_name()
