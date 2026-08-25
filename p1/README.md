# How the Chunker Works — Reference Guide

This document explains **why** the chunker is built the way it is, and **how each
piece works**, so you can rebuild your own version without copying code blindly.
It assumes you know basic Python but have never used the `ast` module before.

---

## 1. The goal

Take a source file and split it into **logical pieces** — one per function, one
per class, one for whatever's left over (imports, docstring, constants) — instead
of chopping it every N characters. The subject is explicit about this:

> "A fixed-size chunker does not pass this part."

Each piece becomes a `Chunk`: a small object holding the exact text, where it
starts/ends, and an identity string used later for embedding and diffing.

```python
@dataclass
class Chunk:
    id: str              # "notes/service.py::NoteService.search"
    file: str
    kind: str             # "function" | "async_function" | "class" | "module"
    qualified_name: str
    content: str            # the exact source text of this piece
    start_line: int
    end_line: int
```

The `id` is built from **structure** (file + name path), not from content. That
matters later: it's what lets you tell "this function's body changed" apart from
"this is a brand new function" (covered in the sync/watcher doc, not here).

---

## 2. What `ast` actually gives you

`ast.parse(source)` turns Python source text into a tree of objects — one object
per statement/expression. You don't need to understand the whole tree, only
three node types:

| Node type | Represents |
|---|---|
| `ast.FunctionDef` | a `def foo():` |
| `ast.AsyncFunctionDef` | an `async def foo():` |
| `ast.ClassDef` | a `class Foo:` |

Every node has two useful attributes handed to you for free:

- `node.lineno` — the line number where the node starts (1-indexed)
- `node.end_lineno` — the line number where it ends (Python 3.8+)

So for a function, you already know its exact line range without writing any
parsing logic yourself. That's the whole reason `ast` beats regex here — no
counting braces, no guessing where a block ends.

```python
tree = ast.parse(source)
# tree is now an ast.Module — the root of the whole file
```

---

## 3. Walking the tree

A file is a tree, not a flat list — a class contains methods, a function can
contain a nested function. To find every function/class **anywhere** in the
file, you need to walk down into each node's children.

`ast.iter_child_nodes(node)` gives you the direct children of a node (one level
down, not the whole subtree). You call it repeatedly, going one level deeper
each time you find something worth stepping into.

The simplest way to think about it: keep a **stack** of "nodes I still need to
look inside." Start with the whole file on the stack. Pop a node, look at its
children:

- if a child is a function/class → record it as a chunk, then push it onto the
  stack too (so we also look *inside* it, in case it has nested defs)
- otherwise → push it onto the stack as-is (so we keep going deeper without
  recording anything — e.g. an `if` block at module level)

```python
stack = [(tree, [])]          # (node, scope_path)
while stack:
    node, scope_path = stack.pop()
    for child in ast.iter_child_nodes(node):
        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # record a chunk here
            stack.append((child, scope_path + [child.name]))
        elif isinstance(child, ast.ClassDef):
            # record a chunk here
            stack.append((child, scope_path + [child.name]))
        else:
            stack.append((child, scope_path))
```

You could write this as a recursive function calling itself instead of a stack
— both work identically. The stack version just avoids a nested function
definition, which makes each step easier to test on its own.

---

## 4. Qualified names — tracking "where am I in the tree"

A method called `search` inside class `NoteService` should not be indexed as
just `"search"` — that would collide with any other `search` function elsewhere
in the project. You want `"NoteService.search"`.

This is what `scope_path` in the walk above is for: it's the list of enclosing
names you've enclosing names you've passed through so far. Every time you step
into a class or function, you append its name to the path before recursing.

```
module level:      scope_path = []
inside NoteService: scope_path = ["NoteService"]
inside search():    scope_path = ["NoteService", "search"]  (only matters if search has a nested def)
```

Joining the path with the current name gives the qualified name:
```python
qualified_name = ".".join(scope_path + [child.name])
# "NoteService.search"
```

---

## 5. Decorators — a gotcha

If a function has a decorator:

```python
@staticmethod
def helper(x):
    ...
```

`node.lineno` points to the `def` line, **not** the `@staticmethod` line. If you
only use `node.lineno` as your chunk's start, you silently lose the decorator
from the indexed content — which matters a lot in Part 3 if this chunk is ever
used as a base to generate a patch.

Decorators live in `node.decorator_list`, each with their own `.lineno`. The
fix is simple: if there are decorators, start the chunk at the **earliest**
decorator's line instead of the `def` line.

```python
def decorator_start(node):
    if node.decorator_list:
        return min(d.lineno for d in node.decorator_list)
    return node.lineno
```

---

## 6. Turning a node into a Chunk

Once you know a node's start line and end line, building the `Chunk` is just
slicing the file's lines and packaging metadata:

```python
def slice_lines(lines, start, end):
    return "".join(lines[start - 1 : end])   # lines are 1-indexed, list is 0-indexed

def make_chunk(filepath, lines, qualified_name, kind, start, end):
    content = slice_lines(lines, decorator_start_or(start), end)
    return Chunk(
        id=f"{filepath}::{qualified_name}",
        file=filepath, kind=kind, qualified_name=qualified_name,
        content=content, start_line=start, end_line=end,
    )
```

`lines = source.splitlines(keepends=True)` beforehand — `keepends=True` keeps
the `\n` at the end of each line, so re-joining the slice reproduces the
original text exactly (needed later if this chunk feeds a patch).

---

## 7. Classes are a special case

If you chunk a class the same way as a function — from `node.lineno` to
`node.end_lineno` — you get the **entire class body**, methods included. But
each method is *also* being recorded as its own chunk one level down. Result:
every method's source exists twice in your index (once alone, once buried
inside the class chunk), which pollutes retrieval and wastes embeddings.

The fix: a class chunk should stop **right before its first method** — so it
only contains the class signature, docstring, and any class-level attributes.

```python
def class_body_end(class_node):
    methods = [n for n in class_node.body
               if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    if methods:
        return methods[0].lineno - 1     # stop right before the first method
    return class_node.end_lineno          # no methods -> whole class is fine
```

```python
class NoteService:
    """Public API of the notes app."""     # <- class chunk ends here

    def __init__(self, storage=None):      # <- __init__'s own chunk starts here
        ...
```

---

## 8. What's left over — module-level code

Imports, the module docstring, top-level constants — none of these are
functions or classes, so the walk above never touches them. If you stop here,
they simply vanish from your index. That's a real gap, not a cosmetic one:
your demo app's imports are part of "what the code does."

The fix: after collecting function/class chunks, figure out **which line
numbers were never claimed** by any of them, and turn the leftover lines into
their own chunk(s).

```python
def top_level_claimed_lines(tree):
    claimed = set()
    for node in tree.body:              # tree.body = only TOP-LEVEL statements
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            claimed.update(range(decorator_start(node), node.end_lineno + 1))
    return claimed
```

Then: any line number from 1 to the end of the file that isn't in `claimed` is
leftover. Group consecutive leftover line numbers together (so imports at the
top become one chunk, a constant defined later becomes a separate chunk,
rather than one giant chunk spanning unrelated gaps), skip runs that are pure
blank lines, and wrap each run in a `Chunk` with `kind="module"`.

```
lines 1-4: docstring + imports   -> one "module" chunk
lines 6-33: class + methods       -> already chunked above
lines 36-37: standalone_function   -> already chunked above
```

---

## 9. Handling files that don't parse, or aren't Python

`ast.parse` raises `SyntaxError` on invalid Python. Rather than crashing the
whole indexer, catch it and fall back to something weaker but still useful: a
regex that looks for lines starting with `def`/`function`/`func`/`fn` (covers
Python, JS, Go, Rust loosely). It won't understand nesting or decorators — that
trade-off is expected, it's explicitly a fallback, not the primary path.

```python
try:
    tree = ast.parse(source)
except SyntaxError:
    return chunk_with_regex_fallback(filepath, source)
```

If even the regex finds nothing (e.g. a config file with no functions at all),
fall back one more level: index the **whole file as a single chunk**. This is
also the correct behavior on purpose for files like `ioc.config.yml` or
`README.md`, which have no sub-structure worth splitting.

---

## 10. Putting it all together

The final function is just these pieces called in order:

```python
def chunk_python_file(filepath, source):
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return chunk_with_regex_fallback(filepath, source)

    lines = source.splitlines(keepends=True)

    chunks  = walk_functions_and_classes(tree, filepath, lines)   # section 3-7
    chunks += leftover_module_chunks(tree, filepath, lines)        # section 8
    chunks.sort(key=lambda c: c.start_line)                          # keep source order

    return chunks
```

Nothing here is exotic — it's five small, independently understandable steps:
parse → walk → name → slice → catch what's left over. Rebuilding your own
version means implementing each of these five ideas in whatever shape fits
your codebase, not copying this exact code.

---

## 11. Design decisions worth keeping (even if you rewrite everything)

- **id from structure, not content** — lets you detect edits vs. new chunks later.
- **hash content separately from the id** — never hash line numbers, or an
  unrelated edit earlier in the file will look like every later chunk changed.
- **class chunk stops before the first method** — avoids duplicate content in
  the index.
- **decorators belong to the chunk that follows them** — losing them breaks
  round-tripping the code later.
- **leftover module-level code is a real chunk, not a gap** — imports and
  config files are part of what the subject expects to see indexed.
- **regex fallback exists, but is explicitly second-class** — don't spend much
  effort perfecting it; the subject only requires it as a safety net.

---

## 12. Testing checklist

Before moving on to hashing/embedding, verify against a small sample file with
a module docstring, imports, one class with 3+ methods (including one
decorated method), and one standalone function:

1. Total chunk count matches what you'd expect by eye.
2. The class chunk stops before its first method.
3. The decorated method's chunk includes the `@decorator` line.
4. Qualified names are correct (`NoteService.search`, not just `search`).
5. Imports/docstring appear as a `module` chunk, not silently dropped.
6. No line of source appears in two different chunks.
7. Chunks come back sorted by `start_line`.