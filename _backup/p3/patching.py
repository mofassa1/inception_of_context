import ast
import os
import shutil
from pathlib import Path

from langchain_core.messages import HumanMessage

from p1.core.errors import InvalidPatch
from p1.core.logging import get_logger
from p3.models import CodePatch, PatchFile
from p1.pipeline import forget_path
from p2.llm import OllamaModelManager, trim_history
from p2.retrieval import RetrievalService

logger = get_logger(__name__)

MAX_FILES_PER_PATCH = 3
MAX_SHRINK_RATIO = 0.6

# Markers this project's own retrieval layer puts around context blocks. A model
# that echoes one of these back has copied the prompt into the file instead of
# writing code, so the content is rejected before it can be written to disk.
RETRIEVAL_MARKERS = (
    "─── ",
    "FILE YOU ARE VIEWING",
    "CURSOR HERE",
    "RELEVANT CODE CONTEXT",
    "AVAILABLE FILES",
    "USER REQUEST:",
)

# A model asked for "the complete file" sometimes answers with a placeholder
# instead. Any of these standing alone means the file would be wiped.
PLACEHOLDER_CONTENTS = ("", "none", "null")

PROMPT_TEMPLATE = """
You are a coding agent responsible for proposing changes to an existing codebase.
{history}
USER REQUEST:
{query}

AVAILABLE FILES:
{file_paths}

RELEVANT CODE CONTEXT:
{context}
{feedback}
RULES:

1. Only modify files whose paths appear in AVAILABLE FILES, and copy the path
   string EXACTLY as it is listed there, including the leading directories.
   Do not shorten it to a relative path.
2. For each file, choose exactly one operation:
   - "create": create a new file, only if it does not already exist.
   - "modify": modify an existing file.
   - "delete": delete an existing file.
3. For "modify" and "create", provide the COMPLETE resulting content of the file.
   Do NOT provide a diff, a patch, or only the changed lines.
4. For "delete", no content is required.
5. Do not modify files unrelated to the request, and do not invent file paths.
6. Preserve existing structure and behavior unless the request requires changing it.
7. Make the smallest reasonable change that satisfies the request.
8. Do not return explanations, markdown, diffs, or code fences outside the
   structured response.
9. If the request is a question, review, or anything that does NOT require a code
   change: use "noop", leave content empty, and put the answer in "summary".
10. If the request does require changes, use "create", "modify" or "delete", and
    describe them in one sentence in "summary", for example
    "Add a hello() function that prints hello to hello.py".
    Never put only the operation name in "summary".
11. The request may refer to the conversation ("add it", "put it there"). Use
    CONVERSATION SO FAR to work out what it means before deciding on "noop".
"""

OPERATION_WORDS = {"", "create", "modify", "delete", "noop"}

OPERATION_VERBS = {"create": "Create", "modify": "Modify", "delete": "Delete"}

NO_CHANGE_SUMMARY = (
    "No change proposed. Say which file to change and what it should contain."
)

SANITY_MESSAGES = {
    0: "",
    1: "No code changes are required.",
    2: "The model returned no files.",
    3: f"The model changed more than {MAX_FILES_PER_PATCH} files.",
    4: "The model used an invalid file operation.",
    5: "The model tried to create a file that already exists.",
    8: "A create or modify operation is an unimplemented stub.",
    9: "A modify operation would remove most of the existing file.",
    11: "The content contains retrieval markers copied from the prompt context "
        "instead of real code.",
    12: "A modify operation would replace a non-empty file with a placeholder "
        "such as an empty string, 'None' or 'null'.",
}


def format_history(turns: list[tuple[str, str]]) -> str:
    kept = trim_history(turns)
    if not kept:
        return ""

    lines = [f"{role.upper()}: {content}" for role, content in kept]
    return "\nCONVERSATION SO FAR (oldest first):\n" + "\n".join(lines) + "\n"


def describe_patch(summary: str, files: list, target_root: str | None) -> str:
    """The model's summary, unless it is only an operation name.

    qwen2.5-coder fills `summary` with "create" or "noop" more often than not,
    and the chat shows that word as the whole reply.
    """
    text = summary.strip()
    if text.lower().rstrip(".") not in OPERATION_WORDS:
        return text

    changes = [entry for entry in files if entry.op in OPERATION_VERBS]
    if not changes:
        return NO_CHANGE_SUMMARY

    def shown(path: str) -> str:
        if target_root and path.startswith(target_root.rstrip(os.sep) + os.sep):
            return os.path.relpath(path, target_root)
        return path

    return "; ".join(
        f"{OPERATION_VERBS[entry.op]} {shown(entry.path)}" for entry in changes
    ) + "."


def build_prompt(
    query: str,
    file_paths: list[str],
    context: str,
    feedback: str = "",
    history: list[tuple[str, str]] | None = None,
) -> str:
    return PROMPT_TEMPLATE.format(
        history=format_history(history or []),
        query=query,
        file_paths="\n".join(file_paths),
        context=context,
        feedback=f"\nPREVIOUS ATTEMPT FAILED:\n{feedback}\n" if feedback else "",
    )


def resolve_patch_path(
    raw_path: str, target_root: str | None, indexed_files: list[str]
) -> str:
    """Turn whatever path the model returned into the absolute one the index uses.

    Small models answer with a project-relative path (`notes/service.py`) however
    firmly the prompt lists absolute ones. Comparing that against the index
    rejected every proposal as "not indexed", so the loop could never succeed.
    """
    candidate = Path(raw_path).expanduser()

    if candidate.is_absolute():
        return str(candidate.resolve())

    if target_root:
        root = Path(target_root)
        # "demo/hello.py" from a model looking at the demo project means
        # <root>/hello.py; joining it as-is creates <root>/demo/hello.py.
        if (
            len(candidate.parts) > 1
            and candidate.parts[0] == root.name
            and not (root / candidate).exists()
        ):
            candidate = Path(*candidate.parts[1:])

        joined = (root / candidate).resolve()
        if str(joined) in indexed_files or joined.exists():
            return str(joined)

    suffix = os.sep + str(candidate)
    matches = [known for known in indexed_files if known.endswith(suffix)]
    if len(matches) == 1:
        return matches[0]

    if target_root:
        return str((Path(target_root) / candidate).resolve())

    return str(candidate)


def leaks_retrieval_markers(content: str) -> bool:
    return any(marker in content for marker in RETRIEVAL_MARKERS)


def is_placeholder_content(content: str) -> bool:
    return content.strip().strip("\"'").lower() in PLACEHOLDER_CONTENTS


def file_is_non_empty(file_path: str) -> bool:
    """A path can be indexed and gone from disk; treat that as nothing to lose."""
    try:
        return os.path.getsize(file_path) > 0
    except OSError as error:
        logger.debug("cannot size %s: %s", file_path, error)
        return False


def is_unimplemented_stub(content: str) -> bool:
    """True when any function in `content` has a body that does nothing.

    The subject names three shapes: `pass`, `...` and `return None`. A bare
    `return` counts too — it is the same empty body written differently.
    """
    try:
        tree = ast.parse(content)
    except SyntaxError as error:
        logger.debug("stub check skipped, content is not valid Python: %s", error)
        return False

    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue

        body = node.body
        if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str):
            body = body[1:]

        if len(body) != 1:
            continue

        only = body[0]
        if isinstance(only, ast.Pass):
            return True
        if (
            isinstance(only, ast.Expr)
            and isinstance(only.value, ast.Constant)
            and only.value.value is Ellipsis
        ):
            return True
        if isinstance(only, ast.Return) and (
            only.value is None
            or (isinstance(only.value, ast.Constant) and only.value.value is None)
        ):
            return True

    return False


def backup_files(files: list[dict], backup_dir: str) -> list[str]:
    created: list[str] = []

    for entry in files:
        if entry["op"] not in ("modify", "delete"):
            continue
        if not os.path.isfile(entry["path"]):
            continue

        destination = os.path.join(backup_dir, entry["path"].lstrip(os.sep))
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        shutil.copy2(entry["path"], destination)
        created.append(destination)

    return created


def apply_files(files: list[dict], store) -> list[str]:
    staged: list[tuple[str, str]] = []
    to_delete: list[str] = []

    try:
        for entry in files:
            path = entry["path"]

            if entry["op"] in ("create", "modify"):
                parent = os.path.dirname(path)
                if parent:
                    os.makedirs(parent, exist_ok=True)

                temporary = path + ".ioc.tmp"
                Path(temporary).write_text(entry["content"], encoding="utf-8")
                staged.append((temporary, path))
            elif entry["op"] == "delete":
                to_delete.append(path)

        for temporary, final in staged:
            os.replace(temporary, final)

        for path in to_delete:
            if os.path.isfile(path):
                os.remove(path)
            forget_path(store, path)
    except Exception:
        for temporary, _ in staged:
            if os.path.isfile(temporary):
                os.remove(temporary)
        raise

    return [final for _, final in staged] + to_delete


class PatchingService:
    def __init__(
        self,
        store,
        retrieval: RetrievalService,
        llm: OllamaModelManager,
    ):
        self.store = store
        self.retrieval = retrieval
        self.llm = llm

    def sanity_check(self, patch: CodePatch) -> int:
        """The hard refusals from the subject (VI.3), and only those.

        Codes 1, 2 and 4 are not refusals of a change but patches that have no
        change to apply at all.
        """
        if not patch.files:
            return 2

        if all(entry.op == "noop" for entry in patch.files):
            return 1

        changes = [entry for entry in patch.files if entry.op != "noop"]

        if len(changes) > MAX_FILES_PER_PATCH:
            return 3

        for entry in changes:
            if entry.op not in ("create", "modify", "delete"):
                return 4
            if entry.op == "create" and os.path.exists(entry.path):
                return 5

            if entry.op in ("create", "modify"):
                if leaks_retrieval_markers(entry.content):
                    return 11
                if is_unimplemented_stub(entry.content):
                    return 8

            if entry.op == "modify" and file_is_non_empty(entry.path):
                if is_placeholder_content(entry.content):
                    return 12

                existing_size = os.path.getsize(entry.path)
                shrink = (existing_size - len(entry.content.encode("utf-8"))) / existing_size
                if shrink > MAX_SHRINK_RATIO:
                    return 9

        return 0

    def propose(
        self,
        query: str,
        k: int = 5,
        feedback: str = "",
        target_root: str | None = None,
        history: list[tuple[str, str]] | None = None,
    ) -> dict:
        self.llm.ensure_pulled(self.llm.code_model)

        indexed_files = self.store.indexed_files()
        context_chunks = self.retrieval.build_context(query, k)

        prompt = build_prompt(
            query=query,
            file_paths=indexed_files,
            context="\n\n".join(context_chunks),
            feedback=feedback,
            history=history,
        )

        patch = self.llm.generate_patch([HumanMessage(content=prompt)])

        for entry in patch.files:
            entry.path = resolve_patch_path(entry.path, target_root, indexed_files)

        code = self.sanity_check(patch)

        if code:
            logger.info("patch proposal flagged: %s", SANITY_MESSAGES[code])

        return {
            "summary": describe_patch(patch.summary, patch.files, target_root),
            "files": [
                entry.model_dump() for entry in patch.files if entry.op != "noop"
            ],
            "sanity": {"code": code, "message": SANITY_MESSAGES[code]},
        }

    def apply(self, files: list[dict], backup_dir: str) -> list[str]:
        if not files:
            raise InvalidPatch("no files to apply")

        code = self.sanity_check(
            CodePatch(summary="", files=[PatchFile(**entry) for entry in files])
        )
        if code:
            raise InvalidPatch(SANITY_MESSAGES[code])

        backup_files(files, backup_dir)
        return apply_files(files, self.store)
