import shlex
import subprocess
from dataclasses import dataclass
from pathlib import Path

import yaml

from p1.core.logging import get_logger

logger = get_logger(__name__)

CONFIG_FILENAME = "ioc.config.yml"
FILES_PLACEHOLDER = "{files}"
DEFAULT_COMMAND = "python -m py_compile {files}"
DEFAULT_TIMEOUT_SECONDS = 120
MAX_OUTPUT_CHARS = 4000


@dataclass(frozen=True)
class ValidationConfig:
    command: str
    timeout_seconds: int
    source: str


@dataclass(frozen=True)
class ValidationResult:
    passed: bool
    output: str
    command: str


def load_config(target_root: str) -> ValidationConfig:
    """Read `ioc.config.yml` from the target project root.

    A missing or malformed file is not fatal: the loop falls back to the
    subject's baseline, `python -m py_compile {files}` over the modified files.
    """
    config_path = Path(target_root) / CONFIG_FILENAME

    if not config_path.is_file():
        logger.info("no %s in %s; using default validation", CONFIG_FILENAME, target_root)
        return ValidationConfig(DEFAULT_COMMAND, DEFAULT_TIMEOUT_SECONDS, "default")

    try:
        parsed = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as error:
        logger.warning("cannot read %s: %s; using default validation", config_path, error)
        return ValidationConfig(DEFAULT_COMMAND, DEFAULT_TIMEOUT_SECONDS, "default")

    section = parsed.get("validation") or {}
    command = section.get("command") or DEFAULT_COMMAND
    timeout = section.get("timeout") or DEFAULT_TIMEOUT_SECONDS

    return ValidationConfig(str(command), int(timeout), str(config_path))


def expand_command(command: str, modified_files: list[str]) -> list[str]:
    """Split the command and put the modified files where `{files}` stands."""
    arguments: list[str] = []

    for argument in shlex.split(command):
        if argument == FILES_PLACEHOLDER:
            arguments.extend(modified_files)
        else:
            arguments.append(argument.replace(FILES_PLACEHOLDER, " ".join(modified_files)))

    return arguments


def run(
    config: ValidationConfig, target_root: str, modified_files: list[str]
) -> ValidationResult:
    """Run the validation command in the target project and capture its output.

    The command comes from the target project's own config file, so it runs
    without a shell: a project that wants a pipeline can wrap it in a script.
    """
    try:
        completed = subprocess.run(
            expand_command(config.command, modified_files),
            stdin=subprocess.DEVNULL,
            cwd=target_root,
            capture_output=True,
            text=True,
            timeout=config.timeout_seconds,
        )
    except FileNotFoundError as error:
        return ValidationResult(False, f"validation command not found: {error}", config.command)
    except subprocess.TimeoutExpired:
        return ValidationResult(
            False,
            f"validation timed out after {config.timeout_seconds}s",
            config.command,
        )

    output = (completed.stdout + completed.stderr).strip()
    if len(output) > MAX_OUTPUT_CHARS:
        output = output[:MAX_OUTPUT_CHARS] + "\n… output truncated"

    return ValidationResult(completed.returncode == 0, output, config.command)
