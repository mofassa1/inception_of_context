import json
import subprocess
import urllib.request

OLLAMA_URL = "http://127.0.0.1:11434"

# Measured: the AI agent server, the indexer, the bridge and the dashboard, idle.
STACK_RAM_GIB = 1.5

# Measured: download size from the Ollama registry, RAM of the loaded model with a 4096-token context.
MODELS = [
    {"name": "qwen2.5:3b", "download_gib": 1.80, "ram_gib": 2.02},
    {"name": "qwen2.5-coder:3b", "download_gib": 1.80, "ram_gib": 2.02},
    {"name": "qwen2.5:1.5b", "download_gib": 0.92, "ram_gib": 1.10},
    {"name": "qwen2.5-coder:1.5b", "download_gib": 0.92, "ram_gib": 1.10},
    {"name": "qwen2.5:0.5b", "download_gib": 0.37, "ram_gib": 0.49},
    {"name": "qwen2.5-coder:0.5b", "download_gib": 0.37, "ram_gib": 0.49},
]


def find_model(name):
    for model in MODELS:
        if model["name"] == name:
            return model
    return None


def fits_in_free_ram(name, free_ram_gib):
    return find_model(name)["ram_gib"] <= free_ram_gib - STACK_RAM_GIB


def recommend_models(free_ram_gib):
    room_for_models = free_ram_gib - STACK_RAM_GIB

    both_3b_models = find_model("qwen2.5:3b")["ram_gib"] + find_model("qwen2.5-coder:3b")["ram_gib"]
    if room_for_models >= both_3b_models:
        return {"ask_model": "qwen2.5:3b", "code_model": "qwen2.5-coder:3b", "warning": ""}

    for name in ["qwen2.5-coder:3b", "qwen2.5-coder:1.5b"]:
        if room_for_models >= find_model(name)["ram_gib"]:
            return {"ask_model": name, "code_model": name, "warning": ""}

    smallest = "qwen2.5-coder:0.5b"
    if fits_in_free_ram(smallest, free_ram_gib):
        warning = (
            "warning: only the 0.5B model fits in free RAM, its answers and patches are weaker. "
            "Close some programs and run make install-models again to get a bigger one."
        )
    else:
        warning = (
            "warning: not enough free RAM even for the 0.5B model next to the rest of the project. "
            "Close some programs before make FOLDER=<folder>."
        )
    return {"ask_model": smallest, "code_model": smallest, "warning": warning}


def list_installed_models():
    try:
        with urllib.request.urlopen(OLLAMA_URL + "/api/tags", timeout=3) as response:
            tags = json.load(response)
    except (OSError, ValueError):
        return None

    names = []
    for model in tags.get("models", []):
        names.append(model["name"])
    return names


def pull_model(name):
    result = subprocess.run(["ollama", "pull", name])
    return result.returncode == 0
