# /// script
# requires-python = ">=3.10"
# dependencies = ["questionary==2.1.1", "psutil==7.2.2"]
# ///

import os
import shutil
import sys

import questionary

from machine import read_machine
from ollama_models import (
    MODELS,
    OLLAMA_URL,
    fits_in_free_ram,
    list_installed_models,
    pull_model,
    recommend_models,
)

REPOSITORY_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_FILE = os.path.join(REPOSITORY_ROOT, "models.mk")
SAME_AS_ASK_MODEL = "same-as-ask-model"


def print_machine_report(machine, installed_models):
    print()
    print("Machine")
    print(f"  CPU     {machine['cpu_cores']} cores")
    print(f"  RAM     {machine['free_ram_gib']:.1f} GiB free of {machine['total_ram_gib']:.1f} GiB")

    gpu = machine["nvidia_gpu"]
    if gpu is None:
        print("  GPU     no NVIDIA GPU: the models run on the CPU, torch is installed for the CPU")
    else:
        print(f"  GPU     {gpu['name']}, {gpu['memory_gib']:.1f} GiB")

    print(
        f"  Disk    {machine['free_disk_gib']:.0f} GiB free for the models ({machine['model_folder']})"
    )

    if installed_models is None:
        print(f"  Ollama  not answering on {OLLAMA_URL}")
    elif len(installed_models) == 0:
        print("  Ollama  running, no models yet")
    else:
        print(f"  Ollama  running, models: {', '.join(installed_models)}")
    print()


def read_previous_choice():
    previous_choice = {}
    if not os.path.isfile(MODELS_FILE):
        return previous_choice

    model_names = []
    for model in MODELS:
        model_names.append(model["name"])
    with open(MODELS_FILE, encoding="utf-8") as models_file:
        for line in models_file:
            if ":=" not in line:
                continue
            key, value = line.split(":=", 1)
            if value.strip() in model_names:
                previous_choice[key.strip()] = value.strip()
    return previous_choice


def save_choice(ask_model, code_model):
    with open(MODELS_FILE, "w", encoding="utf-8") as models_file:
        models_file.write("# written by make install-models (setup/pick_models.py)\n")
        models_file.write(f"ASK_MODEL := {ask_model}\n")
        models_file.write(f"CODE_MODEL := {code_model}\n")


def describe_model(model, recommended_name, free_ram_gib, installed_models):
    description = (
        f"{model['name']:<20} {model['download_gib']:.1f} GiB download, "
        f"{model['ram_gib']:.1f} GiB RAM"
    )

    labels = []
    if model["name"] == recommended_name:
        labels.append("Recommended")
    if not fits_in_free_ram(model["name"], free_ram_gib):
        labels.append("may not fit in free RAM")
    if model["name"] in installed_models:
        labels.append("installed")

    if len(labels) > 0:
        description += "  (" + ", ".join(labels) + ")"
    return description


def ask_for_model(
    message, first_choices, recommended_name, default_value, machine, installed_models
):
    choices = list(first_choices)
    for model in MODELS:
        description = describe_model(
            model, recommended_name, machine["free_ram_gib"], installed_models
        )
        choices.append(questionary.Choice(title=description, value=model["name"]))

    return questionary.select(message, choices=choices, default=default_value).ask()


def pick_models_in_terminal(machine, installed_models, recommended, previous_choice):
    ask_model = ask_for_model(
        "Model for Ask (questions about the code)",
        [],
        recommended["ask_model"],
        previous_choice.get("ASK_MODEL", recommended["ask_model"]),
        machine,
        installed_models,
    )
    if ask_model is None:
        return None

    same_as_ask_model = questionary.Choice(
        title=f"Same as the Ask model ({ask_model}), only one model in RAM",
        value=SAME_AS_ASK_MODEL,
    )
    default_code_model = previous_choice.get("CODE_MODEL", recommended["code_model"])
    if default_code_model == previous_choice.get("ASK_MODEL", recommended["ask_model"]):
        default_code_model = SAME_AS_ASK_MODEL

    code_model = ask_for_model(
        "Model for the patch loop (writes the code)",
        [same_as_ask_model],
        recommended["code_model"],
        default_code_model,
        machine,
        installed_models,
    )
    if code_model is None:
        return None
    if code_model == SAME_AS_ASK_MODEL:
        code_model = ask_model

    return {"ask_model": ask_model, "code_model": code_model}


def main():
    machine = read_machine()
    installed_models = list_installed_models()
    print_machine_report(machine, installed_models)

    if installed_models is None or shutil.which("ollama") is None:
        print("Ollama is needed first: install it, start it, then run: make install-models")
        return 1

    recommended = recommend_models(machine["free_ram_gib"])
    previous_choice = read_previous_choice()

    if sys.stdin.isatty():
        choice = pick_models_in_terminal(machine, installed_models, recommended, previous_choice)
        if choice is None:
            print("cancelled, nothing changed")
            return 1
    else:
        choice = {
            "ask_model": previous_choice.get("ASK_MODEL", recommended["ask_model"]),
            "code_model": previous_choice.get("CODE_MODEL", recommended["code_model"]),
        }
        print(
            f"no terminal to ask in, using ASK_MODEL={choice['ask_model']} CODE_MODEL={choice['code_model']}"
        )

    if recommended["warning"]:
        print(recommended["warning"])

    for model_name in [choice["ask_model"], choice["code_model"]]:
        if model_name in installed_models:
            continue
        print(f"pulling {model_name} ...")
        if not pull_model(model_name):
            print(f"could not pull {model_name}, nothing saved")
            return 1
        installed_models.append(model_name)

    save_choice(choice["ask_model"], choice["code_model"])
    print(f"saved in models.mk: ASK_MODEL={choice['ask_model']} CODE_MODEL={choice['code_model']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
