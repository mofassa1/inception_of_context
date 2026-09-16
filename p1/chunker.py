from dataclasses import dataclass
import ast
import re
from matplotlib import lines

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



FUNC_PATTERN = re.compile(r'^\s*(def|function|func|fn)\s+(\w+)', re.MULTILINE)


from hashing import hash_chunk

class Chunker:
    def chunk_python_file(self, filepath: str, source: str) -> list[Chunk]:
        try:
            tree = ast.parse(source)
        except SyntaxError:
            return self.__chunk_with_regex_fallback(filepath, source)

        lines = source.splitlines(keepends=True)
        chunks = []

        def visit(node, scope_path: list[str]):
            for child in ast.iter_child_nodes(node):

                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    qualified = ".".join(scope_path + [child.name])
                    kind = "async_function" if isinstance(child, ast.AsyncFunctionDef) else "function"
                    chunks.append(self._build_chunk(filepath, child, lines, qualified, kind))
                    visit(child, scope_path + [child.name])

                elif isinstance(child, ast.ClassDef):
                    qualified = ".".join(scope_path + [child.name])
                    method_nodes = [n for n in child.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
                    class_end = (method_nodes[0].lineno - 1) if method_nodes else child.end_lineno
                    chunks.append(self._build_chunk_ranged(
                        filepath, child, lines, qualified, "class",
                        child.lineno, class_end
                    ))
                    visit(child, scope_path + [child.name])

                else:
                    visit(child, scope_path)

        visit(tree, [])

        module_chunks = self._extract_module_level_chunks(filepath, tree, lines)
        chunks.extend(module_chunks)

        chunks.sort(key=lambda c: c.start_line) 
        return chunks
    
    def _extract_module_level_chunks(self, filepath: str, tree: ast.Module, lines: list[str]) -> list[Chunk]:
        top_level_func_class_lines = set()
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                start = node.lineno
                if node.decorator_list:
                    start = min(d.lineno for d in node.decorator_list)
                top_level_func_class_lines.update(range(start, node.end_lineno + 1))

        total_lines = len(lines)
        leftover_line_nums = [
            i for i in range(1, total_lines + 1)
            if i not in top_level_func_class_lines
        ]

        if not leftover_line_nums:
            return []

        runs = []
        run_start = leftover_line_nums[0]
        prev = run_start
        for ln in leftover_line_nums[1:]:
            if ln != prev + 1:
                runs.append((run_start, prev))
                run_start = ln
            prev = ln
        runs.append((run_start, prev))

        chunks = []
        for i, (start, end) in enumerate(runs):
            content = "".join(lines[start - 1: end])
            if not content.strip():
                continue 
            name = "__module__" if i == 0 else f"__module__{i}"
            chunks.append(Chunk(
                id=f"{filepath}::{name}",
                file=filepath, kind="module", qualified_name=name,
                content=content, start_line=start, end_line=end,
                content_hash=hash_chunk(content),
            ))
        return chunks

    def __chunk_with_regex_fallback(self, filepath: str, source: str) -> list[Chunk]:
        lines = source.splitlines(keepends=True)
        matches = list(FUNC_PATTERN.finditer(source))
        chunks = []
        for i, m in enumerate(matches):
            start_line = source[: m.start()].count("\n") + 1
            end_line = (
                source[: matches[i + 1].start()].count("\n")
                if i + 1 < len(matches)
                else len(lines)
            )
            name = m.group(2)
            chunks.append(Chunk(
                id=f"{filepath}::{name}",
                file=filepath, kind="function_regex",
                qualified_name=name,
                content="".join(lines[start_line - 1 : end_line]),
                start_line=start_line, end_line=end_line,
                content_hash=hash_chunk("".join(lines[start_line - 1 : end_line])
            )))
        if not chunks: 
            chunks = [Chunk(id=f"{filepath}::__file__", file=filepath, kind="raw",
                            qualified_name="__file__", content=source,
                            start_line=1, end_line=len(lines),
                            content_hash=hash_chunk(source))]
        return chunks



    def _build_chunk(self, filepath, node, lines, qualified_name, kind) -> Chunk:
        start = node.lineno
        if node.decorator_list:
            start = min(d.lineno for d in node.decorator_list)

        end = node.end_lineno

        content = "".join(lines[start - 1 : end])  

        return Chunk(
            id=f"{filepath}::{qualified_name}",
            file=filepath,
            kind=kind,
            qualified_name=qualified_name,
            content=content,
            start_line=start,
            end_line=end,
            content_hash=hash_chunk(content),
        )
    def _build_chunk_ranged(self, filepath, node, lines, qualified_name, kind, start_line, end_line) -> Chunk:
        start = start_line
        if hasattr(node, "decorator_list") and node.decorator_list:
            start = min(d.lineno for d in node.decorator_list)

        content = "".join(lines[start - 1 : end_line])

        return Chunk(
            id=f"{filepath}::{qualified_name}",
            file=filepath,
            kind=kind,
            qualified_name=qualified_name,
            content=content,
            start_line=start,
            end_line=end_line,
            content_hash=hash_chunk(content),
        )

    def chunk_with_regex_fallback(self,filepath: str, source: str) -> list[Chunk]:
        lines = source.splitlines(keepends=True)
        matches = list(FUNC_PATTERN.finditer(source))

        if not matches:
            return [self._whole_file_chunk(filepath, source, lines)]

        chunks = []
        for i, match in enumerate(matches):
            start_line = source[: match.start()].count("\n") + 1
            end_line = (
                source[: matches[i + 1].start()].count("\n")
                if i + 1 < len(matches)
                else len(lines)
            )
            name = match.group(2)
            chunks.append(self._make_chunk(
                filepath, lines, name, "function_regex",
                start_line=start_line, end_line=end_line,
            ))
        return chunks


    def _whole_file_chunk(self, filepath: str, source: str, lines: list[str]) -> Chunk:
        return Chunk(
            id=f"{filepath}::__file__",
            file=filepath, kind="raw", qualified_name="__file__",
            content=source, start_line=1, end_line=len(lines) or 1,
            content_hash=hash_chunk(source)
        )
    def _make_chunk(self, filepath, lines, qualified_name, kind, start_line, end_line, decorator_start=None) -> Chunk:
        start = decorator_start if decorator_start is not None else start_line
        content = self._slice_lines(lines, start, end_line)
        return Chunk(
            id=f"{filepath}::{qualified_name}",
            file=filepath,
            kind=kind,
            qualified_name=qualified_name,
            content=content,
            start_line=start,
            end_line=end_line,
            content_hash=hash_chunk(content)
        )
    def _slice_lines(self, lines: list[str], start_line: int, end_line: int) -> str:
        """1-indexed, inclusive line slice back into text."""
        return "".join(lines[start_line - 1 : end_line])
