# Chunks of a file: one per function and class in Python, pieces of lines for anything else.
# A chunk never holds a whole big file: a prompt made of chunks has to fit the model's window.

import ast
import hashlib
import re
from dataclasses import dataclass

MAX_CHUNK_LINES = 40
# A definition with a keyword, indented or not: def, function, async function, export
# function, func, fn, class. [ \t]* and not \s*, or a match would start on a blank line before.
FUNCTION_PATTERN = re.compile(
    r"^[ \t]*(?:export[ \t]+(?:default[ \t]+)?)?(?:async[ \t]+)?"
    r"(?:def|function\*?|func|fn|class)[ \t]+(\w+)",
    re.MULTILINE,
)
# A function given to a name at the top level: const api = async () =>, form.onsubmit =
# function. Column 0 only, so an arrow function nested in another one does not split it.
ASSIGNED_FUNCTION_PATTERN = re.compile(
    r"^(?:export[ \t]+)?(?:(?:const|let|var)[ \t]+)?([A-Za-z_$][\w$.]*)[ \t]*=[ \t]*"
    r"(?:async[ \t]+)?(?:function\b|\([^)\n]*\)[ \t]*=>|[A-Za-z_$][\w$]*[ \t]*=>)",
    re.MULTILINE,
)


@dataclass
class Chunk:
    id: str
    file: str
    kind: str
    qualified_name: str
    content: str
    start_line: int
    end_line: int
    content_hash: str


def hash_content(content):
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def build_chunk(path, lines, name, kind, start_line, end_line):
    content = "".join(lines[start_line - 1 : end_line])
    return Chunk(
        id=f"{path}::{name}",
        file=path,
        kind=kind,
        qualified_name=name,
        content=content,
        start_line=start_line,
        end_line=end_line,
        content_hash=hash_content(content),
    )


def build_line_chunks(path, lines, name, kind, start_line, end_line):
    chunks = []
    for piece_start in range(start_line, end_line + 1, MAX_CHUNK_LINES):
        piece_end = min(piece_start + MAX_CHUNK_LINES - 1, end_line)
        piece_name = name if piece_start == start_line else f"{name}@{piece_start}"
        chunks.append(build_chunk(path, lines, piece_name, kind, piece_start, piece_end))
    return chunks


def definition_start(node):
    if node.decorator_list:
        return min(decorator.lineno for decorator in node.decorator_list)
    return node.lineno


def python_chunks(path, lines, tree):
    chunks = []
    covered_lines = set()

    def visit(node, scope):
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                name = ".".join(scope + [child.name])
                kind = "async_function" if isinstance(child, ast.AsyncFunctionDef) else "function"
                chunks.append(
                    build_chunk(path, lines, name, kind, definition_start(child), child.end_lineno)
                )
                covered_lines.update(range(definition_start(child), child.end_lineno + 1))
                visit(child, scope + [child.name])
            elif isinstance(child, ast.ClassDef):
                name = ".".join(scope + [child.name])
                methods = [
                    item
                    for item in child.body
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef))
                ]
                header_end = methods[0].lineno - 1 if methods else child.end_lineno
                chunks.append(
                    build_chunk(path, lines, name, "class", definition_start(child), header_end)
                )
                covered_lines.update(range(definition_start(child), header_end + 1))
                visit(child, scope + [child.name])
            else:
                visit(child, scope)

    visit(tree, [])
    chunks.extend(module_chunks(path, lines, covered_lines))
    chunks.sort(key=lambda chunk: chunk.start_line)
    return chunks


def module_chunks(path, lines, covered_lines):
    # The lines outside every function and class: imports, constants, the __main__ block.
    chunks = []
    start_line = None
    for number in range(1, len(lines) + 2):
        inside_run = number <= len(lines) and number not in covered_lines
        if inside_run and start_line is None:
            start_line = number
        elif not inside_run and start_line is not None:
            if "".join(lines[start_line - 1 : number - 1]).strip() != "":
                name = "__module__" if not chunks else f"__module__{len(chunks)}"
                chunks.extend(
                    build_line_chunks(path, lines, name, "module", start_line, number - 1)
                )
            start_line = None
    return chunks


def text_chunks(path, lines, source):
    # No Python syntax: cut on the functions a regex can see, then on length.
    chunks = []
    starts = {}
    for pattern in (FUNCTION_PATTERN, ASSIGNED_FUNCTION_PATTERN):
        for match in pattern.finditer(source):
            starts.setdefault(match.start(), match)
    matches = [starts[start] for start in sorted(starts)]

    # The lines before the first function: imports, constants, a header comment.
    if matches:
        first_line = source[: matches[0].start()].count("\n") + 1
        if "".join(lines[: first_line - 1]).strip() != "":
            chunks.extend(build_line_chunks(path, lines, "__module__", "module", 1, first_line - 1))

    for position, match in enumerate(matches):
        start_line = source[: match.start()].count("\n") + 1
        if position + 1 < len(matches):
            end_line = source[: matches[position + 1].start()].count("\n")
        else:
            end_line = len(lines)
        chunks.extend(
            build_line_chunks(path, lines, match.group(1), "function_regex", start_line, end_line)
        )
    if not chunks:
        chunks = build_line_chunks(path, lines, "__file__", "lines", 1, max(len(lines), 1))
    return chunks


def unique_ids(chunks):
    # Two code samples in one file can carry the same name. ChromaDB refuses duplicate ids.
    seen = {}
    for chunk in chunks:
        seen[chunk.id] = seen.get(chunk.id, 0) + 1
        if seen[chunk.id] > 1:
            chunk.id = f"{chunk.id}#{seen[chunk.id]}"
    return chunks


def chunk_file(path, source):
    lines = source.splitlines(keepends=True)
    if not lines:
        return []
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return unique_ids(text_chunks(path, lines, source))
    return unique_ids(python_chunks(path, lines, tree))
