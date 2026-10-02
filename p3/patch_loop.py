# Part 3 of the subject: the model proposes a patch, hard sanity checks refuse it or let it
# through, it is applied atomically, the validation command decides, and after three failed
# attempts the project goes back to the exact state it had before the loop.
#
# The loop gets its search and its model as arguments, so this file depends on nothing else.

import ast
import difflib
import os
import re
import shlex
import signal
import subprocess
import sys
import tempfile
import threading

import yaml

MAX_ATTEMPTS = 3
MAX_FILES = 3
MAX_SHRINK = 0.6
CONTEXT_FILES = 3
CONTEXT_CHARACTERS = 6000
LISTED_FILES = 60
FEEDBACK_CHARACTERS = 1500
CHANGED_LINES_CHARACTERS = 2500
OUTPUT_CHARACTERS = 4000
TIMEOUT_SECONDS = 120
TEMPORARY_SUFFIX = ".ioc.tmp"
CONFIG_FILE = "ioc.config.yml"
BASELINE_COMMAND = "python -m py_compile {files}"
MARKER = "<<<IOC"
EMPTY_CONTENTS = ["", "None", "null"]

OK = 0
LEAKED_MARKER = 1
CREATE_EXISTING = 2
EMPTIED_FILE = 3
STUB_FUNCTION = 4
FILE_SHRINKS = 5
TOO_MANY_FILES = 6
NO_FILE = 7
NO_CHANGE_NEEDED = 8
MISSING_FILE = 9
OUTSIDE_PROJECT = 10
IGNORED_PATH = 11
SAME_PATH_TWICE = 12
NOT_TEXT = 13
INVALID_ANSWER = 14
NOT_CREATED = 15

SANITY_MESSAGES = {
    OK: "ok",
    LEAKED_MARKER: f"a file contains the {MARKER} markers of the prompt",
    CREATE_EXISTING: "'create' on a file that already exists",
    EMPTIED_FILE: 'a non-empty file would be replaced by "", "None" or "null"',
    STUB_FUNCTION: "a new function has only a stub body (pass, ..., return None)",
    FILE_SHRINKS: "a file would shrink by more than 60 %",
    TOO_MANY_FILES: f"the patch touches more than {MAX_FILES} files",
    NO_FILE: "the patch has no file to change",
    NO_CHANGE_NEEDED: "the request needs no change, the answer is the summary",
    MISSING_FILE: "'modify' or 'delete' on a file that does not exist",
    OUTSIDE_PROJECT: "a path is outside the project",
    IGNORED_PATH: "a path is ignored",
    SAME_PATH_TWICE: "the same path is in the patch twice: give each file once, with all its changes",
    NOT_TEXT: "the file to modify is not a text file",
    INVALID_ANSWER: "the model answer is not a valid patch",
    NOT_CREATED: "the request asks to create a file the patch does not create",
}

PROMPT = """You change a code project so it does what the user asks.

USER REQUEST:
{query}
{named}
PROJECT FILES:
{file_list}

CURRENT CONTENT OF THE MOST RELEVANT FILES:
{file_blocks}
{feedback}
ANSWER RULES:
- Answer with a summary and a list of files. Each file has a path, an op and a content.
- op "modify": change a file of PROJECT FILES. content is the COMPLETE new file, never a diff.
- op "create": add a file that is not in PROJECT FILES. content is the COMPLETE file.
- op "delete": remove a file of PROJECT FILES. content is "".
- Write the paths exactly as they are written above. Touch at most {max_files} files.
- Keep every line that does not need to change. Never drop unrelated code.
- Write real code: no function whose body is only pass, ... or return None.
- Never copy the {marker} lines into a file.
- If the request is a question that needs no change, answer it in the summary and return one
  file with op "noop", path "" and content "".
"""

FEEDBACK = """
YOUR PREVIOUS ATTEMPT FAILED, fix it this time.
Previous summary: {summary}
Previous files: {files}
Why it failed:
{reason}
{changes}"""

CHANGES = """These lines of the original files were removed or changed by your previous attempt.
Put back, exactly as written here, every one the request does not ask to change:
{lines}
"""

NAMED = """THE REQUEST NAMES THESE FILES, they come first below: {files}
"""

loop_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Paths: everything the loop touches stays inside the project
# ---------------------------------------------------------------------------


def resolve_in_project(project_root, path):
    root = os.path.realpath(project_root)
    full_path = os.path.realpath(path if os.path.isabs(path) else os.path.join(root, path))
    if not full_path.startswith(root + os.sep):
        return None
    return full_path


def relative_to_project(project_root, full_path):
    return os.path.relpath(full_path, os.path.realpath(project_root))


def is_ignored(full_path, ignored_paths):
    for ignored_path in ignored_paths:
        ignored = os.path.realpath(ignored_path)
        if full_path == ignored or full_path.startswith(ignored + os.sep):
            return True
    return False


# ---------------------------------------------------------------------------
# The prompt: the files the search found, with their current content
# ---------------------------------------------------------------------------


def named_files(project_root, query):
    # The files a request writes out, as a path ("tasks/storage.py") or a module ("tasks.storage").
    named = []
    for word in re.findall(r"[\w./-]+", query):
        word = word.strip("./")
        candidates = [word]
        if "/" not in word and "." in word and not os.path.splitext(word)[1] in (".py", ".md"):
            candidates.append(word.replace(".", "/") + ".py")
        for candidate in candidates:
            full_path = resolve_in_project(project_root, candidate) if candidate else None
            if full_path and os.path.isfile(full_path) and full_path not in named:
                named.append(full_path)
    return named


FILE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".md", ".txt", ".json",
    ".yml", ".yaml", ".toml", ".cfg", ".ini", ".sh",
}


def requested_new_files(project_root, query):
    # A path the request writes out that does not exist yet can only mean "create it":
    # "Create tests/test_export.py". A module name ("tasks.export") is only a reference.
    requested = []
    for word in re.findall(r"[\w./-]+", query):
        word = word.strip("./")
        if os.path.splitext(word)[1] not in FILE_EXTENSIONS:
            continue
        full_path = resolve_in_project(project_root, word)
        if full_path and not os.path.lexists(full_path) and full_path not in requested:
            requested.append(full_path)
    return requested


def build_context(project_root, sources, ignored_paths, named=()):
    # The files the request names come first: a small model edits the first file it is shown,
    # even when the search ranked another file higher.
    files = []
    characters_left = CONTEXT_CHARACTERS
    for source in [{"file": path} for path in named] + list(sources):
        full_path = resolve_in_project(project_root, source["file"])
        if full_path is None or is_ignored(full_path, ignored_paths):
            continue
        if any(full_path == other for other, _ in files):
            continue
        try:
            with open(full_path, encoding="utf-8") as file:
                content = file.read()
        except (OSError, UnicodeDecodeError):
            continue
        if len(content) > characters_left or len(files) == CONTEXT_FILES:
            continue
        characters_left = characters_left - len(content)
        files.append((full_path, content))
    return files


def build_prompt(project_root, query, project_files, context_files, feedback, named=()):
    blocks = []
    for full_path, content in context_files:
        name = relative_to_project(project_root, full_path)
        blocks.append(f"{MARKER} FILE {name}>>>\n{content.rstrip()}\n{MARKER} END>>>")

    named_names = ", ".join(relative_to_project(project_root, path) for path in named)
    return PROMPT.format(
        query=query,
        named=NAMED.format(files=named_names) if named_names else "",
        file_list="\n".join(project_files) or "(nothing indexed yet)",
        file_blocks="\n\n".join(blocks) or "(no file found for this request)",
        feedback=feedback,
        max_files=MAX_FILES,
        marker=MARKER,
    )


def build_feedback(patch, reason, changed_lines=""):
    files = "none"
    summary = "none"
    if patch is not None:
        summary = patch.summary
        files = ", ".join(f"{file.path} ({file.op})" for file in patch.files) or "none"
    changes = CHANGES.format(lines=changed_lines[:CHANGED_LINES_CHARACTERS]) if changed_lines else ""
    return FEEDBACK.format(
        summary=summary, files=files, reason=reason[-FEEDBACK_CHARACTERS:], changes=changes
    )


def changed_lines(project_root, snapshot, changes):
    # A small model rewriting a whole file also "tidies" lines nobody asked about. Listing the
    # original lines it lost lets the next attempt put them back. Plain lines, not a diff:
    # shown a diff, a small model answers with one.
    found = []
    for full_path, op, content in changes:
        state = snapshot["files"].get(full_path)
        if op != "modify" or state is None:
            continue
        try:
            before = state["content"].decode("utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        name = relative_to_project(project_root, full_path)
        matcher = difflib.SequenceMatcher(a=before, b=content.splitlines(), autojunk=False)
        for tag, first, last, _, _ in matcher.get_opcodes():
            if tag in ("replace", "delete"):
                for number in range(first, last):
                    if before[number].strip():
                        found.append(f"{name}, line {number + 1}: {before[number]}")
    return "\n".join(found)


# ---------------------------------------------------------------------------
# What the model answered, cleaned of the habits of small models
# ---------------------------------------------------------------------------


def without_fences(content):
    # A file wrapped in a markdown code block: keep what is inside.
    lines = content.strip("\n").splitlines()
    if len(lines) >= 2 and lines[0].startswith("```") and lines[-1].strip() == "```":
        return "\n".join(lines[1:-1]) + "\n"
    return content


def clean_patch(patch, project_root):
    for file in patch.files:
        file.content = without_fences(file.content)

    # The same path twice, once as it already is: that entry changes nothing, drop it.
    paths = [resolve_in_project(project_root, file.path) for file in patch.files]
    kept = []
    for file, full_path in zip(patch.files, paths):
        if full_path is not None and paths.count(full_path) > 1 and file.op == "modify":
            try:
                with open(full_path, encoding="utf-8") as opened:
                    if opened.read() == file.content:
                        continue
            except (OSError, UnicodeDecodeError):
                pass
        kept.append(file)
    patch.files = kept
    return patch


# ---------------------------------------------------------------------------
# Sanity checks: hard refusals, before anything is written
# ---------------------------------------------------------------------------


def refusal(code, path=""):
    if path == "":
        return code, SANITY_MESSAGES[code]
    return code, f"{SANITY_MESSAGES[code]}: {path}"


def is_stub_body(body):
    statements = list(body)
    first = statements[0]
    is_docstring = (
        isinstance(first, ast.Expr)
        and isinstance(first.value, ast.Constant)
        and isinstance(first.value.value, str)
    )
    if is_docstring and len(statements) > 1:
        statements = statements[1:]
    if len(statements) != 1:
        return False

    statement = statements[0]
    if isinstance(statement, ast.Pass):
        return True
    if isinstance(statement, ast.Expr) and isinstance(statement.value, ast.Constant):
        return statement.value.value is Ellipsis
    if isinstance(statement, ast.Return):
        if statement.value is None:
            return True
        return isinstance(statement.value, ast.Constant) and statement.value.value is None
    return False


def stub_functions(source):
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return set()

    found = set()
    to_visit = [(tree, "")]
    while to_visit:
        node, scope = to_visit.pop()
        for child in ast.iter_child_nodes(node):
            child_scope = scope
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                child_scope = scope + "." + child.name
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and is_stub_body(
                child.body
            ):
                found.add(child_scope)
            to_visit.append((child, child_scope))
    return found


def check_file(file, full_path):
    if MARKER in file.content:
        return refusal(LEAKED_MARKER, file.path)

    if file.op == "create":
        if os.path.lexists(full_path):
            return refusal(CREATE_EXISTING, file.path)
        if full_path.endswith(".py") and stub_functions(file.content):
            return refusal(STUB_FUNCTION, file.path)
        return refusal(OK)

    if not os.path.isfile(full_path):
        return refusal(MISSING_FILE, file.path)
    if file.op == "delete":
        return refusal(OK)

    try:
        with open(full_path, encoding="utf-8") as opened:
            old_content = opened.read()
    except UnicodeDecodeError:
        return refusal(NOT_TEXT, file.path)

    if old_content.strip() != "" and file.content.strip() in EMPTY_CONTENTS:
        return refusal(EMPTIED_FILE, file.path)
    if full_path.endswith(".py") and stub_functions(file.content) - stub_functions(old_content):
        return refusal(STUB_FUNCTION, file.path)
    if len(file.content) < (1 - MAX_SHRINK) * len(old_content):
        return refusal(FILE_SHRINKS, file.path)
    return refusal(OK)


def check_patch(patch, project_root, ignored_paths, to_create=()):
    files = [file for file in patch.files if file.op != "noop"]
    if not files:
        return refusal(NO_CHANGE_NEEDED) if patch.files else refusal(NO_FILE)
    if len(files) > MAX_FILES:
        return refusal(TOO_MANY_FILES)

    # A patch that passes the tests without the file it was asked for is not a success.
    created = [resolve_in_project(project_root, file.path) for file in files if file.op == "create"]
    for full_path in to_create:
        if full_path not in created:
            return refusal(NOT_CREATED, relative_to_project(project_root, full_path))

    seen_paths = []
    for file in files:
        full_path = resolve_in_project(project_root, file.path)
        if full_path is None:
            return refusal(OUTSIDE_PROJECT, file.path)
        if is_ignored(full_path, ignored_paths):
            return refusal(IGNORED_PATH, file.path)
        if full_path in seen_paths:
            return refusal(SAME_PATH_TWICE, file.path)
        seen_paths.append(full_path)

        code, message = check_file(file, full_path)
        if code != OK:
            return code, message
    return refusal(OK)


# ---------------------------------------------------------------------------
# Snapshot, apply, restore: the only part that writes in the project
# ---------------------------------------------------------------------------


def file_state(path):
    if not os.path.isfile(path):
        return None
    status = os.stat(path)
    with open(path, "rb") as file:
        return {"content": file.read(), "mode": status.st_mode & 0o7777, "time": status.st_mtime_ns}


def take_snapshot(snapshot, full_paths):
    for full_path in full_paths:
        for path in [full_path, full_path + TEMPORARY_SUFFIX]:
            if path not in snapshot["files"]:
                snapshot["files"][path] = file_state(path)

        folder = os.path.dirname(full_path)
        while not os.path.isdir(folder):
            if folder not in snapshot["folders"]:
                snapshot["folders"].append(folder)
            folder = os.path.dirname(folder)


def apply_patch(changes):
    written = []
    for full_path, op, content in changes:
        if op == "delete":
            continue
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        temporary_path = full_path + TEMPORARY_SUFFIX
        with open(temporary_path, "w", encoding="utf-8", newline="") as file:
            file.write(content)
        if os.path.isfile(full_path):
            os.chmod(temporary_path, os.stat(full_path).st_mode & 0o7777)
        written.append((temporary_path, full_path))

    for temporary_path, full_path in written:
        os.replace(temporary_path, full_path)
    for full_path, op, content in changes:
        if op == "delete":
            os.remove(full_path)


def restore_snapshot(snapshot):
    for path, state in snapshot["files"].items():
        if state is None:
            if os.path.lexists(path):
                os.remove(path)
        elif file_state(path) != state:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            temporary_path = path + TEMPORARY_SUFFIX
            with open(temporary_path, "wb") as file:
                file.write(state["content"])
            os.chmod(temporary_path, state["mode"])
            os.replace(temporary_path, path)
            os.utime(path, ns=(state["time"], state["time"]))

    for folder in sorted(snapshot["folders"], key=len, reverse=True):
        if os.path.isdir(folder) and not os.listdir(folder):
            os.rmdir(folder)


# ---------------------------------------------------------------------------
# Validation: the command of ioc.config.yml, and no leftovers in the project
# ---------------------------------------------------------------------------


class ConfigError(Exception):
    pass


def read_validation_command(project_root):
    config_path = os.path.join(project_root, CONFIG_FILE)
    if not os.path.isfile(config_path):
        return None

    try:
        with open(config_path, encoding="utf-8") as config_file:
            config = yaml.safe_load(config_file)
    except yaml.YAMLError as error:
        raise ConfigError(f"{CONFIG_FILE} is not valid YAML: {error}")

    command = None
    if isinstance(config, dict) and isinstance(config.get("validation"), dict):
        command = config["validation"].get("command")
    if not isinstance(command, str) or command.strip() == "":
        raise ConfigError(f"{CONFIG_FILE} has no validation.command")
    return command


def run_command(project_root, command):
    with tempfile.TemporaryDirectory() as bytecode_folder:
        environment = dict(os.environ)
        environment["PATH"] = (
            os.path.dirname(sys.executable) + os.pathsep + environment.get("PATH", "")
        )
        environment["PYTHONPYCACHEPREFIX"] = bytecode_folder
        environment["PYTEST_ADDOPTS"] = (
            environment.get("PYTEST_ADDOPTS", "") + " -p no:cacheprovider"
        ).strip()

        process = subprocess.Popen(
            command,
            shell=True,
            cwd=project_root,
            env=environment,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            start_new_session=True,
        )
        try:
            output, _ = process.communicate(timeout=TIMEOUT_SECONDS)
            return process.returncode, output
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            output, _ = process.communicate()
            return None, output


def validation_reason(output):
    # The line that says why: the last exception message (the first ones of a traceback are
    # often "Failed to import test module"), then a failed test, then the last line.
    lines = [line.strip() for line in output.strip().splitlines()]
    exceptions = [
        line
        for line in lines
        if re.match(r"^\w*(Error|Exception): ", line) and "Failed to import test module" not in line
    ]
    if exceptions:
        return exceptions[-1]
    failures = [line for line in lines if re.match(r"^(FAIL|ERROR): ", line)]
    if failures:
        return failures[0]
    return lines[-1] if lines else ""


def run_validation(project_root, command, changed_files):
    note = ""
    if command is None:
        note = f"{CONFIG_FILE} not found, the baseline runs on the changed .py files\n"
        changed_files = [path for path in changed_files if path.endswith(".py")]
        if not changed_files:
            return True, note + "no .py file changed, nothing to check"
        command = BASELINE_COMMAND

    command = command.replace("{files}", " ".join(shlex.quote(path) for path in changed_files))
    exit_code, output = run_command(project_root, command)
    output = output[-OUTPUT_CHARACTERS:].strip()

    if exit_code is None:
        result = f"stopped after {TIMEOUT_SECONDS} s"
    elif exit_code == 0:
        result = "passed"
    else:
        result = f"failed with exit code {exit_code}"

    lines = [note + "$ " + command]
    if output:
        lines.append(output)
    lines.append(result)
    return exit_code == 0, "\n".join(lines)


# ---------------------------------------------------------------------------
# The loop: generate, check, apply, validate, up to three times
# ---------------------------------------------------------------------------


def new_attempt(number, summary, files, sanity):
    code, message = sanity
    return {
        "number": number,
        "summary": summary,
        "files": files,
        "sanity": {"code": code, "message": message},
        "applied": False,
        "validation_passed": False,
        "validation_output": "",
    }


def attempt_files(patch, project_root):
    files = []
    for file in patch.files:
        if file.op == "noop":
            continue
        full_path = resolve_in_project(project_root, file.path)
        path = relative_to_project(project_root, full_path) if full_path else file.path
        files.append({"path": path, "op": file.op, "content": file.content})
    return files


def patch_changes(patch, project_root):
    changes = []
    for file in patch.files:
        if file.op != "noop":
            changes.append((resolve_in_project(project_root, file.path), file.op, file.content))
    return changes


def loop_result(succeeded, attempts, rolled_back, files_touched, summary):
    return {
        "succeeded": succeeded,
        "attempts": attempts,
        "rolled_back": rolled_back,
        "files_touched": sorted(files_touched),
        "summary": summary,
    }


def run_attempts(query, k, project_root, ignored_paths, search, generate, report):
    command = read_validation_command(project_root)
    snapshot = {"files": {}, "folders": []}
    project_files = []
    named = [path for path in named_files(project_root, query) if not is_ignored(path, ignored_paths)]
    to_create = [
        path for path in requested_new_files(project_root, query) if not is_ignored(path, ignored_paths)
    ]
    attempts = []
    feedback = ""
    succeeded = False

    try:
        for number in range(1, MAX_ATTEMPTS + 1):
            sources = search(query, k, ignored_paths)
            context_files = build_context(project_root, sources, ignored_paths, named)
            project_files = sorted(
                {relative_to_project(project_root, path) for path, _ in context_files}
            )
            prompt = build_prompt(project_root, query, project_files, context_files, feedback, named)

            try:
                patch = clean_patch(generate(prompt), project_root)
            except Exception as error:
                attempts.append(new_attempt(number, "", [], refusal(INVALID_ANSWER, str(error))))
                feedback = build_feedback(None, f"your answer could not be read: {error}")
                report("error", project_root, 0)
                continue

            code, message = check_patch(patch, project_root, ignored_paths, to_create)
            attempt = new_attempt(
                number, patch.summary, attempt_files(patch, project_root), (code, message)
            )
            attempts.append(attempt)

            if code == NO_CHANGE_NEEDED:
                return loop_result(False, attempts, False, [], patch.summary)
            if code != OK:
                feedback = build_feedback(patch, message)
                continue

            changes = patch_changes(patch, project_root)
            take_snapshot(snapshot, [full_path for full_path, _, _ in changes])
            try:
                apply_patch(changes)
            except OSError as error:
                restore_snapshot(snapshot)
                attempt["validation_output"] = f"the patch could not be written: {error}"
                feedback = build_feedback(patch, attempt["validation_output"])
                continue

            attempt["applied"] = True
            changed_files = [
                relative_to_project(project_root, full_path)
                for full_path, op, _ in changes
                if op != "delete"
            ]
            passed, output = run_validation(project_root, command, changed_files)
            attempt["validation_passed"] = passed
            attempt["validation_output"] = output

            if passed:
                succeeded = True
                touched = [
                    relative_to_project(project_root, full_path) for full_path, _, _ in changes
                ]
                for path in touched:
                    report("patched", os.path.join(project_root, path), 0)
                return loop_result(True, attempts, False, touched, patch.summary)

            lost = changed_lines(project_root, snapshot, changes)
            restore_snapshot(snapshot)
            feedback = build_feedback(patch, output, lost)

        written = any(attempt["applied"] for attempt in attempts)
        restored = [
            relative_to_project(project_root, path)
            for path in snapshot["files"]
            if not path.endswith(TEMPORARY_SUFFIX)
        ]
        if written:
            summary = f"No attempt passed validation in {MAX_ATTEMPTS} tries. Every file is back as it was."
            return loop_result(False, attempts, True, restored, summary)
        summary = f"No patch passed the sanity checks in {MAX_ATTEMPTS} tries. Nothing was written."
        return loop_result(False, attempts, False, [], summary)
    finally:
        if not succeeded:
            restore_snapshot(snapshot)


def loop(query, k, project_root, target_path, ignored_paths, search, generate, report=None):
    project_root = os.path.realpath(project_root)
    if target_path and os.path.realpath(target_path) != project_root:
        raise ValueError(f"the AI agent works on {project_root}, not on {target_path}")
    if not loop_lock.acquire(blocking=False):
        raise RuntimeError("a patch loop is already running")

    try:
        return run_attempts(
            query,
            k,
            project_root,
            ignored_paths or [],
            search,
            generate,
            report or (lambda *_: None),
        )
    finally:
        loop_lock.release()
