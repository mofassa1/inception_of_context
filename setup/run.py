"""Starts the project and keeps its log: the AI agent, the dashboard server, the window.

    python setup/run.py <folder>    start everything on that folder
    python setup/run.py --logs      show the log of the last run again

Every line of every part goes to .logs/<date_time>.log as
"<part>: <time> <LEVEL> <message>", and to this terminal with colors.
Closing the window, Ctrl+C, or any part stopping ends the run.
"""

import os
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PYTHON = str(REPO / ".venv/bin/python")
MODELS_FILE = REPO / "models.mk"
LOGS_FOLDER = REPO / ".logs"
LATEST_LOG = LOGS_FOLDER / "latest.log"
AI_AGENT_PORT = 8000
SERVER_PORT = 8001
AI_AGENT_URL = f"http://127.0.0.1:{AI_AGENT_PORT}"
SERVER_URL = f"http://127.0.0.1:{SERVER_PORT}"
READY_TIMEOUT_SECONDS = 600

# The watcher of the AI agent indexes every file that changes. If the folder holds this
# repository, a log written inside it would be indexed, which writes another line, forever
# (CHECK.md item 11). Such a run keeps its log outside.
OUTSIDE_LOGS_FOLDER = Path(
    f"/goinfre/{os.environ.get('USER', '')}/.ioc-logs"
    if Path(f"/goinfre/{os.environ.get('USER', '')}").is_dir()
    else Path.home() / ".cache/ioc-logs"
)

NOISE = [
    "unauthenticated requests to the HF Hub",
    "Electron Security Warning",
    "Installed VAAPI version",
]
LEVELS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
LEVEL_COLORS = {"DEBUG": "90", "INFO": "32", "WARNING": "33", "ERROR": "31", "CRITICAL": "31"}
PART_COLORS = {"run": "35", "ai-agent": "36", "server": "96", "ui": "94"}


# ---------------------------------------------------------------------------
# One line of the log: where it comes from, how bad it is, what it says
# ---------------------------------------------------------------------------


def clean_message(text, folders):
    text = text.rstrip("\n")
    if "\r" in text:
        # A progress bar rewrites one line: keep what a terminal would show at the end.
        text = text.rsplit("\r", 1)[1]
    for folder in folders:
        text = text.replace(folder + os.sep, "")
    return text


def level_of(text, in_traceback):
    level = "INFO"
    for name in LEVELS:
        if text.startswith(name + ":"):
            # uvicorn writes its own level: keep it, and keep only the message after it.
            level, text = name, text[len(name) + 1 :].lstrip()
            break

    if text.startswith("Traceback"):
        return "ERROR", text, True
    if in_traceback:
        return "ERROR", text, text.startswith((" ", "\t"))
    if level != "INFO":
        return level, text, False

    # A line of its own still tells how bad it is: an exception, or the status code of a request.
    if "Error" in text or "Exception" in text or '" 5' in text:
        return "ERROR", text, False
    if "Warning" in text or "warning" in text or '" 4' in text:
        return "WARNING", text, False
    return "INFO", text, False


def format_line(part, level, message):
    return f"{part + ':':<10} {datetime.now():%H:%M:%S} {level:<7} {message}"


def color_line(line):
    # The fields have fixed widths, so the message keeps its own spaces (a traceback is indented).
    if len(line) < 28 or line[10] != " " or line[19] != " ":
        return line
    part, moment, level, message = line[:10].strip(), line[11:19], line[20:27].strip(), line[28:]
    if level in ("ERROR", "CRITICAL"):
        message = f"\033[31m{message}\033[0m"
    return (
        f"\033[{PART_COLORS.get(part.rstrip(':'), '37')}m{part:<10}\033[0m "
        f"\033[2m{moment}\033[0m "
        f"\033[{LEVEL_COLORS.get(level, '32')}m{level:<7}\033[0m {message}"
    )


class Log:
    def __init__(self, path, folders):
        self.path = path
        self.folders = folders
        self.lock = threading.Lock()
        self.file = open(path, "a", encoding="utf-8")
        self.in_traceback = {}

    def write(self, part, level, message):
        line = format_line(part, level, message)
        with self.lock:
            self.file.write(line + "\n")
            self.file.flush()
            print(color_line(line), flush=True)

    def write_output(self, part, text):
        message = clean_message(text, self.folders)
        if message.strip() == "" or any(noise in message for noise in NOISE):
            return
        level, message, in_traceback = level_of(message, self.in_traceback.get(part, False))
        self.in_traceback[part] = in_traceback
        self.write(part, level, message)


# ---------------------------------------------------------------------------
# The parts: start them, wait for them, stop them
# ---------------------------------------------------------------------------


class Part:
    def __init__(self, name, command, log, cwd=REPO, env=None):
        self.name = name
        self.log = log
        self.process = subprocess.Popen(
            command,
            cwd=str(cwd),
            env=env or os.environ.copy(),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            start_new_session=True,
        )
        self.reader = threading.Thread(target=self.read_output, daemon=True)
        self.reader.start()

    def read_output(self):
        for text in self.process.stdout:
            self.log.write_output(self.name, text)

    def is_running(self):
        return self.process.poll() is None

    def stop(self):
        if self.is_running():
            try:
                os.killpg(self.process.pid, signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                self.process.terminate()


def answers(url):
    try:
        urllib.request.urlopen(url, timeout=2)
        return True
    except Exception:
        return False


def wait_until_ready(part, url, log):
    log.write("run", "INFO", f"waiting for {part.name} ...")
    deadline = time.monotonic() + READY_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if answers(url):
            log.write("run", "INFO", f"{part.name} is ready")
            return True
        if not part.is_running():
            log.write("run", "ERROR", f"{part.name} stopped before it was ready")
            return False
        time.sleep(0.5)
    log.write("run", "ERROR", f"{part.name} did not answer within {READY_TIMEOUT_SECONDS} s")
    return False


# ---------------------------------------------------------------------------
# What has to be true before starting
# ---------------------------------------------------------------------------


def read_models():
    models = {}
    if MODELS_FILE.is_file():
        for line in MODELS_FILE.read_text(encoding="utf-8").splitlines():
            if ":=" in line:
                key, value = line.split(":=", 1)
                models[key.strip()] = value.strip()
    return models


def port_is_free(port):
    with socket.socket() as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def who_uses(port):
    try:
        found = subprocess.run(
            ["ss", "-lntpH", f"sport = :{port}"], capture_output=True, text=True, timeout=5
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return ""
    return found.strip().split("users:")[-1][:60] if "users:" in found else ""


def model_is_pulled(name):
    try:
        return subprocess.run(
            ["ollama", "show", name], capture_output=True, timeout=30
        ).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def checks_fail(folder, models):
    if not folder.is_dir():
        return f"not a folder: {folder}"
    if str(folder) == "/":
        return "FOLDER=/ would index the whole disk"
    if not models.get("ASK_MODEL") or not models.get("CODE_MODEL"):
        return "no models picked yet, run: make install"

    for name in {models["ASK_MODEL"], models["CODE_MODEL"]}:
        if not model_is_pulled(name):
            return f"{name} is not pulled or Ollama is not running, run: make install-models"

    for port in (AI_AGENT_PORT, SERVER_PORT):
        if not port_is_free(port):
            return (
                f"port {port} is already in use{who_uses(port)}\n"
                "stop the other run first: close its dashboard, or press Ctrl+C in its terminal"
            )
    return ""


# ---------------------------------------------------------------------------
# The run
# ---------------------------------------------------------------------------


def open_log(folder):
    inside_folder = REPO == folder or str(REPO).startswith(str(folder) + os.sep)
    home = OUTSIDE_LOGS_FOLDER if inside_folder else LOGS_FOLDER
    home.mkdir(parents=True, exist_ok=True)
    LOGS_FOLDER.mkdir(parents=True, exist_ok=True)

    path = home / f"{datetime.now():%Y-%m-%d_%H-%M-%S}.log"
    path.touch()
    if LATEST_LOG.is_symlink() or LATEST_LOG.exists():
        LATEST_LOG.unlink()
    LATEST_LOG.symlink_to(path)

    log = Log(path, [str(folder), str(REPO)])
    log.write("run", "INFO", f"folder {folder}")
    log.write("run", "INFO", f"log file {path}")
    if inside_folder:
        log.write(
            "run",
            "WARNING",
            "the folder holds this repository: the log is kept outside it (CHECK.md 11), "
            "and big files make answers slow (CHECK.md 13)",
        )
    return log


def start_everything(folder, models, log, parts):
    # Every part goes into parts as soon as it starts, so a Ctrl+C in the middle still stops it.
    environment = os.environ.copy()
    environment["PYTHONPATH"] = f"{REPO}:{REPO / 'p1'}"
    environment["PYTHONUNBUFFERED"] = "1"
    environment.pop("VIRTUAL_ENV", None)

    agent_environment = dict(
        environment,
        TARGET_PATH=str(folder),
        ASK_MODEL=models["ASK_MODEL"],
        CODE_MODEL=models["CODE_MODEL"],
    )
    agent = Part(
        "ai-agent",
        [PYTHON, "-m", "uvicorn", "p2.api:app", "--host", "127.0.0.1", "--port", str(AI_AGENT_PORT)],
        log,
        env=agent_environment,
    )
    parts.append(agent)
    if not wait_until_ready(agent, AI_AGENT_URL + "/status", log):
        return False

    server = Part("server", [PYTHON, "dashboard/server.py"], log, env=environment)
    parts.append(server)
    if not wait_until_ready(server, SERVER_URL + "/docs", log):
        return False

    window_environment = dict(environment)
    # Set by some terminals: it would start Electron as plain Node, with no window.
    window_environment.pop("ELECTRON_RUN_AS_NODE", None)
    parts.append(
        Part(
            "ui",
            ["npx", "electron", ".", str(folder)],
            log,
            cwd=REPO / "dashboard/ui",
            env=window_environment,
        )
    )
    log.write("run", "INFO", "everything is running, close the window or press Ctrl+C to stop")
    return True


def stop_asked(number, frame):
    raise KeyboardInterrupt


def wait_for_the_end(parts, log):
    try:
        while True:
            for part in parts:
                if not part.is_running():
                    code = part.process.returncode
                    level = "INFO" if code == 0 else "ERROR"
                    log.write("run", level, f"{part.name} stopped (exit code {code})")
                    return
            time.sleep(0.5)
    except KeyboardInterrupt:
        log.write("run", "INFO", "stop asked")


def stop_everything(parts, log):
    for part in parts:
        part.stop()
    time.sleep(1)
    for part in parts:
        if part.is_running():
            try:
                os.killpg(part.process.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                part.process.kill()
    log.write("run", "INFO", "everything stopped")


def free_memory():
    # MemAvailable is what a new process can really take, unlike MemFree.
    try:
        for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
            if line.startswith("MemAvailable:"):
                return f"{int(line.split()[1]) // 1024} MiB"
    except OSError:
        pass
    return "unknown"


def code_version():
    try:
        commit = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(REPO),
            capture_output=True,
            text=True,
            timeout=5,
        ).stdout.strip()
        changed = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=str(REPO),
            capture_output=True,
            text=True,
            timeout=5,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return "unknown"
    return f"commit {commit}" + (", with uncommitted changes" if changed else "")


def show_last_log():
    if not LATEST_LOG.exists():
        print("no logs yet, start the project with: make FOLDER=<folder>")
        return 1
    for line in LATEST_LOG.read_text(encoding="utf-8").splitlines():
        print(color_line(line))
    return 0


def main():
    if len(sys.argv) != 2 or sys.argv[1].strip() == "":
        print("usage: make FOLDER=<folder>")
        return 1
    if sys.argv[1] == "--logs":
        return show_last_log()

    folder = Path(sys.argv[1]).resolve()
    models = read_models()
    problem = checks_fail(folder, models)
    if problem:
        print(problem)
        return 1

    (REPO / "chroma_db").mkdir(exist_ok=True)
    log = open_log(folder)
    log.write(
        "run",
        "INFO",
        f"models: {models['ASK_MODEL']} for Ask, {models['CODE_MODEL']} for the patch loop",
    )
    log.write("run", "INFO", f"free memory: {free_memory()}")
    log.write("run", "INFO", f"code: {code_version()}")

    # A kill of this process must stop the parts too, the same way Ctrl+C does.
    signal.signal(signal.SIGTERM, stop_asked)
    signal.signal(signal.SIGHUP, stop_asked)

    parts = []
    try:
        if start_everything(folder, models, log, parts):
            wait_for_the_end(parts, log)
    except KeyboardInterrupt:
        log.write("run", "INFO", "stop asked")
    finally:
        stop_everything(parts, log)
    return 0


if __name__ == "__main__":
    sys.exit(main())
