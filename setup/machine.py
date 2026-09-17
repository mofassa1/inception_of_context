import os
import shutil
import subprocess

import psutil

GIBIBYTE = 1024**3


def read_nvidia_gpu():
    if shutil.which("nvidia-smi") is None:
        return None

    command = ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0 or result.stdout.strip() == "":
        return None

    first_gpu = result.stdout.strip().splitlines()[0]
    name, memory_mib = first_gpu.rsplit(",", 1)
    return {"name": name.strip(), "memory_gib": float(memory_mib) / 1024}


def find_ollama_model_folder():
    if os.environ.get("OLLAMA_MODELS"):
        return os.environ["OLLAMA_MODELS"]
    if os.path.isdir("/usr/share/ollama"):
        return "/usr/share/ollama/.ollama/models"
    return os.path.expanduser("~/.ollama/models")


def read_free_disk_gib(folder):
    while not os.path.exists(folder):
        folder = os.path.dirname(folder)
    return psutil.disk_usage(folder).free / GIBIBYTE


def read_machine():
    memory = psutil.virtual_memory()
    model_folder = find_ollama_model_folder()
    return {
        "cpu_cores": psutil.cpu_count(logical=False) or psutil.cpu_count(),
        "total_ram_gib": memory.total / GIBIBYTE,
        "free_ram_gib": memory.available / GIBIBYTE,
        "nvidia_gpu": read_nvidia_gpu(),
        "model_folder": model_folder,
        "free_disk_gib": read_free_disk_gib(model_folder),
    }
