# CHECK

What the dashboard still needs from the AI agent server (:8000). mhrima-server
already uses your objects and names wherever they exist, so this list only has
what cannot be done on our side. First: what changed on our side. Then the index,
items 1–6 (routes), 7–16 (bugs). All outputs below were captured by running your code.

```
 dashboard  ────►  mhrima-server :8001  ────►  AI agent :8000
                   ├─ /api/fs/*          files of the opened folder
                   ├─ /conversations     conversations of the folder (sqlite)
                   ├─ /ask               adds history, stores chats, calls /ask/stream
                   └─ AI routes          call :8000, check the answer with a DTO
```

## How to read a section

Every route section has the same parts, in this order:

```
## N. METHOD /route
┌──────────┬─────────────────────────────┐
│ route    │ method, path, parameters    │
│ screen   │ where the dashboard uses it │
│ today    │ what your server answers    │
│ expected │ status, content-type, DTO   │
└──────────┴─────────────────────────────┘
Contract in mhrima-server.py   links to the DTOs you receive and answer
### Where it shows            the screen, arrows point at the fields
### Request                   parameters table + a curl on :8000
### Response today            real status line + body
### Expected response         status line + content-type + body
### What to change            tables and code from your files
### Check your fix            the same call through mhrima-server :8001
```

Every bug section has the same parts, in this order:

```
## N. title
┌─────────┬───────────────────────┐
│ file    │ file:line             │
│ affects │ what breaks           │
│ result  │ what you see          │
└─────────┴───────────────────────┘
### The code                  your lines, annotated
### What happens              table: input → result
### Reproduce                 script, run from the repo root (temporary folders)
### Output                    real output of the script
### Suggested fix             the change, and the output once applied
```

## How to check a fix

mhrima-server checks your answer against the DTO of the route before the dashboard
gets it. Call the route on :8001 instead of :8000:

```
┌───────────────────┬─────────────────────────────┬────────────────────────────────────────────────────────────────┐
│ your route        │ mhrima-server :8001 answers │ example                                                        │
├───────────────────┼─────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ has the DTO shape │ 200, your JSON              │ GET /files → 200                                               │
│ is missing        │ your status code + detail   │ GET /chunks → 404 "AI agent GET /chunks answered 404"          │
│ has another shape │ 502 + which field is wrong  │ 502 "did not answer the shape in CHECK.md: ... Field required" │
└───────────────────┴─────────────────────────────┴────────────────────────────────────────────────────────────────┘
```

## Already used as they are

These routes of yours work with the dashboard today, nothing to change:

```
┌────────────────────────┬──────────────────────────────────┬───────────────────────────────────────────────────┐
│ your route             │ used by                          │ note                                              │
├────────────────────────┼──────────────────────────────────┼───────────────────────────────────────────────────┤
│ GET /status/           │ Overview                         │ item 1 adds two fields                            │
│ GET /files             │ Files → list                     │                                                   │
│ GET /files/{file_path} │ Files viewer, editor chunk bands │ the path is sent with its leading / encoded (%2F) │
│ POST /retrieve         │ Ask → Retrieve                   │                                                   │
│ POST /ask/stream       │ chat Ask mode, Ask → Ask LLM     │ plain text works, item 4 adds sources             │
└────────────────────────┴──────────────────────────────────┴───────────────────────────────────────────────────┘
```

## What changed on our side (2026-09-17)

The dashboard side was reworked so the project runs on a laptop without a GPU, and `p3_beta`
was rewritten to do Part 3 of the subject. Everything below was measured on this machine:
Intel i5-7500 (4 cores), 7.7 GiB RAM, AMD RX 470 (no CUDA), Ollama 0.13. The items after the
index are what is left for the AI agent.

### How to run it

```bash
make install               # machine report, you pick the two models, it pulls them, installs everything
make FOLDER=<a project>    # AI agent + indexer + mhrima-server + dashboard, in this terminal
make logs                  # the latest run, with colors
make tests                 # the patch loop tests
```

`FOLDER` must be a small project folder, not this repository: a big file becomes one chunk and the
answers take minutes (CHECK.md item 13), and the watcher would index the logs of the run
(CHECK.md item 11).

### The four changes

```
┌───┬───────────────────┬────────────────────────────────────────────────────────┬───────────────────────────────────────┐
│ # │ part              │ what it does now                                       │ files                                 │
├───┼───────────────────┼────────────────────────────────────────────────────────┼───────────────────────────────────────┤
│ 1 │ make install      │ checks the machine, you pick the models, it pulls them │ setup/, Makefile, models.mk           │
│ 2 │ one terminal      │ everything starts together, one log file, one format   │ Makefile, mhrima-server.py, main.cjs  │
│ 3 │ lighter dashboard │ less memory, no rebuild when nothing changed           │ electron/main.cjs, main.tsx, Makefile │
│ 4 │ p3_beta           │ the patch loop of the subject, one module per job      │ p3_beta/, tests/test_patch_loop.py    │
└───┴───────────────────┴────────────────────────────────────────────────────────┴───────────────────────────────────────┘
```

### 1. `make install` picks the models

`make install` runs three steps: pick and pull the models, install the Python packages, install the
dashboard packages. Each one can be run alone (`make install-models`, `make install-python`,
`make install-dashboard`).

### The picker

`uv run setup/pick_models.py` needs no `.venv`: the script carries its own dependencies
(questionary, psutil). It prints the machine, then asks two questions with the arrow keys.

```
Machine
  CPU     4 cores
  RAM     4.9 GiB free of 7.7 GiB
  GPU     no NVIDIA GPU: the models run on the CPU, torch is installed for the CPU
  Disk    111 GiB free for the models (/usr/share/ollama/.ollama/models)
  Ollama  running, models: qwen2.5-coder:3b

? Model for Ask (questions about the code)
 » qwen2.5-coder:3b     1.8 GiB download, 2.0 GiB RAM  (Recommended, installed)
   qwen2.5:1.5b         0.9 GiB download, 1.1 GiB RAM
   qwen2.5-coder:0.5b   0.4 GiB download, 0.5 GiB RAM
```

- **(Recommended)** is the biggest model that fits the free RAM, minus the 1.5 GiB the rest of the
  project needs (measured).
- The second question also offers "same as the Ask model", which keeps one model in RAM.
- The choice is saved in `models.mk` (gitignored), read by the Makefile and passed to the AI agent
  server as `ASK_MODEL` and `CODE_MODEL`.
- Without a terminal it keeps the previous choice, or takes the recommended one.

```
┌─────────────────────────┬──────────┬─────────────────┐
│ model                   │ download │ RAM when loaded │
├─────────────────────────┼──────────┼─────────────────┤
│ qwen2.5(-coder):3b      │ 1.8 GiB  │ 2.02 GiB        │
│ qwen2.5(-coder):1.5b    │ 0.9 GiB  │ 1.10 GiB        │
│ qwen2.5(-coder):0.5b    │ 0.4 GiB  │ 0.49 GiB        │
│ the rest of the project │          │ 1.5 GiB         │
└─────────────────────────┴──────────┴─────────────────┘
```

### Torch without CUDA

`requirements.txt` is Aziz's file and is not changed. When `nvidia-smi` finds no GPU, `make
install-python` installs the same list without the CUDA packages:

```make
grep -v -E '^(nvidia-|cuda-|triton)' requirements.txt | uv pip install --torch-backend cpu -r -
```

Result: `torch 2.13.0+cpu`, no `nvidia-*` package, `.venv` is 1.4 GB instead of about 6 GB.

### 2. One terminal, one log file

`make FOLDER=<folder>` starts the AI agent server, its indexer, mhrima-server and the dashboard,
one after another, in this terminal. Closing the dashboard, Ctrl+C, or any part stopping ends the
run. Before starting, it checks that ports 8000 and 8001 are free and says which process holds them.

Every line of every part goes to `.logs/<date_time>.log`, with `.logs/latest.log` pointing to the
newest run. `make logs` prints the latest run with colors.

```
make:      16:45:53 INFO    the AI agent server is ready
indexer:   16:46:04 INFO    Total chunks indexed: 13
server:    16:46:05 INFO    AI agent POST /ask/stream: 200, streaming (0.2 s)
server:    16:46:22 INFO    answer done (17.2 s): first text after 13.9 s, 157 characters
ai-agent:  16:46:31 WARNING 127.0.0.1:1 - "GET /chunks?offset=0 HTTP/1.1" 404 Not Found
ui:        16:46:32 ERROR   page: Failed to load resource: 502 (index.html:0)
```

```
┌─────────┬───────────────────────────────────────────────────────────────────────────────┐
│ source  │ make, ai-agent, indexer, server (mhrima-server), ui (dashboard)               │
│ level   │ from the LEVEL: the line starts with, a traceback, Error/Warning, 4xx and 5xx │
│ message │ paths relative to the project folder, a progress bar keeps its last state     │
│ dropped │ empty lines, the Hugging Face token warning, the Electron and VAAPI notices   │
└─────────┴───────────────────────────────────────────────────────────────────────────────┘
```

- **mhrima-server** writes one line per call to the AI agent (status, duration) and one line per
  answer: done, cancelled or failed, with the time of the first word. A stopped AI agent in the
  middle of an answer is logged and the dashboard gets an error.
- **The dashboard** sends its page errors to the same log.
- **`make FOLDER=` refuses a folder that contains this repository**: the AI agent's watcher would
  index its own log again and again (CHECK.md item 11).

### 3. A lighter dashboard

```
┌────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
│ change                                         │ result                                           │
├────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ spellcheck off in the window                   │ Electron 426 -> 406 MB with a file open          │
│ no refetch when the window gets focus, 1 retry │ no burst of requests when switching windows      │
│ dist rebuilt only when a source changed        │ about 10 s saved on every start (0.01 s instead) │
│ one tab per file (bug fix)                     │ a closed file no longer stays on screen          │
└────────────────────────────────────────────────┴──────────────────────────────────────────────────┘
```

**The duplicate tab:** Electron sent the launch paths twice (once on request, once on
`did-finish-load`), and `openFile` checked for an open tab before reading the file, so two tabs with
the same path were created. React cannot remove duplicate keys cleanly, so closing one left a ghost.
Now Electron sends the list once, and `useTabs.openFile` never adds a path that is already open.

**Tried and dropped:** `app.disableHardwareAcceleration()` used about twice the CPU and crashed
Electron on exit (`FATAL: GPU process isn't usable`). Lazy panels would save almost nothing: the
heavy code (CodeMirror, react-markdown) is in the editor, which always loads.

### 4. p3_beta does Part 3 of the subject

`p2/routers/patch_loop.py` still calls `loop(query, k, target_path, ignored_paths)` and gets the same
dictionary. Behind it, `patcher.py` is gone and every job has its own module:

```
┌─────────────────┬─────────────────────────────────────────┬────────────────────────┐
│ module          │ what it does                            │ writes in the project? │
├─────────────────┼─────────────────────────────────────────┼────────────────────────┤
│ patch_loop.py   │ loop(): up to 3 attempts, rollback      │ no                     │
│ generator.py    │ picks the files, asks the code model    │ no                     │
│ prompt.py       │ the prompt text and its <<<IOC markers  │ no                     │
│ sanity_check.py │ check_patch(): the refusals below       │ no, it only reads      │
│ apply_safely.py │ snapshot, apply, restore                │ yes, the only one      │
│ validation.py   │ reads ioc.config.yml, runs the command  │ no                     │
│ paths.py        │ paths inside the project, ignored paths │ no                     │
└─────────────────┴─────────────────────────────────────────┴────────────────────────┘
```

### Where the old code went

```
┌───────────────────────────────┬───────────────────────────────┬─────────────────────────────────────────┐
│ before                        │ now                           │ what changed                            │
├───────────────────────────────┼───────────────────────────────┼─────────────────────────────────────────┤
│ Patcher.build_prompt_template │ prompt.build_prompt           │ the KeyError is gone, feedback included │
│ Patcher.answer_user_query     │ generator.generate_patch      │ sends whole files, not chunks           │
│ Patcher.sanity_checker        │ sanity_check.check_patch      │ the six refusals of the subject, plus 8 │
│ Patcher.create_backup         │ apply_safely.take_snapshot    │ bytes, mode, time, new folders          │
│ Patcher.atomic_replacement    │ apply_safely.apply_patch      │ all *.ioc.tmp, then os.replace          │
│ Patcher.restore_backup        │ apply_safely.restore_snapshot │ also removes created files/folders      │
│ Patcher.launch_tests          │ validation.run_validation     │ {files}, timeout, no __pycache__ left   │
└───────────────────────────────┴───────────────────────────────┴─────────────────────────────────────────┘
```

### The prompt sends whole files

The subject asks for the complete file back (`content` holds the whole post-change file). A model
cannot write that from a few chunks, so the search only picks the files, and the prompt carries
their current text, inside markers, within a budget that fits the model's window:

```
<<<IOC FILE notes/service.py>>>
class NoteService:
    ...
<<<IOC END>>>
```

At most 3 files and 6000 characters of content, plus the list of the indexed files (without the
ignored ones). A file that contains those markers is refused (rule 1 below).

### The refusals

Codes 1 to 6 are the six hard refusals of the subject, checked against the files on disk before
anything is written:

```
┌──────┬────────────────────────────────────────────────────────────────────────┐
│ code │ refused because                                                        │
├──────┼────────────────────────────────────────────────────────────────────────┤
│ 1    │ the content contains the <<<IOC markers of the prompt                  │
│ 2    │ 'create' on a file that already exists                                 │
│ 3    │ a non-empty file would become "", "None" or "null"                     │
│ 4    │ a NEW function whose body is only pass, ... or return None             │
│ 5    │ a file would shrink by more than 60 %                                  │
│ 6    │ more than 3 files                                                      │
│ 7    │ the patch has no file to change                                        │
│ 8    │ the request needs no change: the answer is the summary, the loop stops │
│ 9    │ 'modify' or 'delete' on a file that does not exist                     │
│ 10   │ a path outside the project                                             │
│ 11   │ a path ignored for this conversation                                   │
│ 12   │ the same path twice                                                    │
│ 13   │ the file to modify is not a text file                                  │
│ 14   │ the model answer could not be read as a patch                          │
└──────┴────────────────────────────────────────────────────────────────────────┘
```

Rule 4 compares the functions of the old and the new file: a stub that was already there
(an abstract method, for example) does not block a patch that touches something else.

### Apply, validate, roll back

```
┌──────────┬──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ snapshot │ bytes, mode and time of every touched file, its *.ioc.tmp, and the folders that do not exist yet │
│ apply    │ every *.ioc.tmp is written first, then each os.replace, then the deletes                         │
│ validate │ validation.command of ioc.config.yml, {files} = the changed files, quoted                        │
│ green    │ the loop stops and keeps the files                                                               │
│ red      │ restore, the error goes back to the model, next attempt                                          │
│ after 3  │ restore, rolled_back: true, files_touched lists what was put back                                │
└──────────┴──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Without `ioc.config.yml`**, the baseline of the subject runs: `python -m py_compile {files}` on
  the changed `.py` files, and the answer says so. A broken config stops the loop before attempt 1.
- **The command runs** with `.venv/bin` first in `PATH`, a 120 s timeout (the whole process group is
  stopped), empty stdin, and `PYTHONPYCACHEPREFIX` + `PYTEST_ADDOPTS=-p no:cacheprovider` so
  validation leaves no `__pycache__` or `.pytest_cache` in the project.
- **The rollback is in a `finally`**: even if something raises in the middle, the project goes back
  to the state it had before the loop.
- **One loop at a time** (a lock), and a `target_path` other than the indexed project is refused.

### The real run

With `qwen2.5-coder:3b` on a small project (5 files), through mhrima-server `POST /patch/loop`:

```
┌────────────────────────────────────────────────┬──────────┬──────┬─────────────────────────────────────────────────┐
│ request                                        │ attempts │ time │ result                                          │
├────────────────────────────────────────────────┼──────────┼──────┼─────────────────────────────────────────────────┤
│ "Add a count method to NoteService"            │ 1        │ 56 s │ the method is in the file, validation passed    │
│ "Add a rename method", validation always fails │ 3        │ 93 s │ tree identical byte for byte, nothing left over │
└────────────────────────────────────────────────┴──────────┴──────┴─────────────────────────────────────────────────┘
```

The second run also showed a problem on the AI agent side: `GET /status` sent during the loop
answered after 68 s, because its route is `async def` and blocks the server. It is CHECK.md item 16.

### Tests

`make tests` runs `tests/test_patch_loop.py`: 23 tests, about 5 seconds, no model and no ChromaDB
(a fake generator is put in `sys.modules`, the project is a temporary folder).

```
┌───────────────────────┬─────────────────────────────────────────────────────────────────────────┐
│ test                  │ checks that                                                             │
├───────────────────────┼─────────────────────────────────────────────────────────────────────────┤
│ a green patch stays   │ the file keeps the change, no *.ioc.tmp, no __pycache__                 │
│ 3 red attempts        │ the tree is byte for byte the one from before, modes and times included │
│ each refusal          │ 11 cases, nothing written, the reason goes back to the model            │
│ an old stub           │ a stub already in the file does not block the patch                     │
│ a question            │ one attempt, code 8, the answer is the summary                          │
│ an unreadable answer  │ code 14, the next attempt gets the reason                               │
│ {files}               │ a path with a space arrives quoted in the command                       │
│ no config             │ the baseline compiles the .py files and says so                         │
│ a broken config       │ the loop stops before asking the model                                  │
│ a slow command        │ stopped after the timeout, files restored                               │
│ a crash in the middle │ the exception goes up and the files are still restored                  │
│ another target_path   │ refused                                                                 │
└───────────────────────┴─────────────────────────────────────────────────────────────────────────┘
```

### What was touched in your code

```
┌──────────────────────────┬─────────────────────┬─────────────────────────────────────────────────────────────────────────┐
│ file                     │ change              │ why                                                                     │
├──────────────────────────┼─────────────────────┼─────────────────────────────────────────────────────────────────────────┤
│ p2/llm_object.py         │ one line            │ reads ASK_MODEL / CODE_MODEL, same defaults as before                   │
│ p3_beta/                 │ rewritten           │ you gave it to me; the map above says where each piece went             │
│ p1/utils.py, p1/index.py │ EXCLUDED_DIRS moved │ the watcher and the first walk share one list (item 11)                 │
│ p1/monitor.py            │ two fixes           │ skips hidden/excluded/database folders, indexes a renamed file (11, 12) │
│ p1/chunker.py            │ 40-line pieces      │ a file without functions is no longer one huge chunk (item 13)          │
│ p1/embedder.py           │ one line            │ the cache check looks where the model is saved (item 14)                │
│ p2/routers/patch_loop.py │ async def -> def    │ the loop no longer freezes the server (item 16)                         │
└──────────────────────────┴─────────────────────┴─────────────────────────────────────────────────────────────────────────┘
```

`requirements.txt` is not touched either: the CUDA packages are filtered at install time.

## Index

```
┌────┬───────────────────────┬──────────────────────────────────┬───────────────────────────────┐
│ #  │ item                  │ screen / affects                 │ today                         │
├────┼───────────────────────┼──────────────────────────────────┼───────────────────────────────┤
│ 1  │ GET /status           │ Overview                         │ 2 fields missing, 2 hardcoded │
│ 2  │ GET /events           │ Overview → Live activity         │ 404                           │
│ 3  │ GET /chunks           │ ChromaDB Explorer                │ 404                           │
│ 4  │ POST /ask/stream      │ chat Ask mode, Ask → Ask LLM     │ text/plain, no sources        │
│ 5  │ POST /patch/loop      │ chat Agent mode, Patch Loop      │ done, the route answers       │
│ 6  │ ignored_paths         │ file tree ignore toggles         │ field dropped                 │
│ 7  │ build_prompt_template │ patch loop                       │ fixed, p3_beta rewritten      │
│ 8  │ sanity_checker        │ patch loop                       │ fixed, p3_beta rewritten      │
│ 9  │ loop()                │ patch loop                       │ fixed, p3_beta rewritten      │
│ 10 │ loop() apply steps    │ patch loop                       │ fixed, p3_beta rewritten      │
│ 11 │ watcher               │ index, every answer              │ fixed in your code            │
│ 12 │ watcher on rename     │ index                            │ fixed in your code            │
│ 13 │ chunker               │ every answer, patch prompt       │ fixed in your code            │
│ 14 │ embedder              │ every start                      │ fixed in your code            │
│ 15 │ two Chroma clients    │ Ask, Retrieve, patch loop        │ search fails until restart    │
│ 16 │ async def /patch/loop │ every screen, while a patch runs │ fixed in your code            │
└────┴───────────────────────┴──────────────────────────────────┴───────────────────────────────┘
```

- [1. GET /status](#1-get-status)
- [2. GET /events](#2-get-events)
- [3. GET /chunks](#3-get-chunks)
- [4. POST /ask/stream](#4-post-askstream)
- [5. POST /patch/loop](#5-post-patchloop)
- [6. ignored_paths in /ask/stream and /patch/loop](#6-ignored_paths-in-askstream-and-patchloop)
- [7. build_prompt_template returns an empty prompt](#7-build_prompt_template-returns-an-empty-prompt)
- [8. sanity_checker crashes](#8-sanity_checker-crashes)
- [9. loop crashes before the first attempt](#9-loop-crashes-before-the-first-attempt)
- [10. loop writes each change twice](#10-loop-writes-each-change-twice)
- [11. The watcher indexes .git](#11-the-watcher-indexes-git)
- [12. A renamed file leaves the index](#12-a-renamed-file-leaves-the-index)
- [13. Big chunks make answers take minutes](#13-big-chunks-make-answers-take-minutes)
- [14. The embedder goes online at every start](#14-the-embedder-goes-online-at-every-start)
- [15. A search on a new folder breaks every later search](#15-a-search-on-a-new-folder-breaks-every-later-search)
- [16. The patch loop freezes the whole server](#16-the-patch-loop-freezes-the-whole-server)

## Shared objects

Your chunk format, used by several routes and defined once in `mhrima-server.py`:

```
┌──────────────────┬────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────┐
│ DTO              │ fields                                                                     │ same as                                │
├──────────────────┼────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────┤
│ StoredChunksDTO  │ ids[], documents[], metadatas[]                                            │ your GET /files/{{file_path}} "chunks" │
│ ChunkMetadataDTO │ file, kind, qualified_name, start_line, end_line, content_hash             │ your Chroma metadata                   │
│ AnswerSourceDTO  │ rank, id, file, start_line, end_line, kind, qualified_name, score, content │ item 4 sources line                    │
│ IndexedFileDTO   │ name, chunks                                                               │ your GET /files                        │
└──────────────────┴────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────┘
```

- [`StoredChunksDTO`](mhrima-server.py#L692), [`ChunkMetadataDTO`](mhrima-server.py#L683), [`AnswerSourceDTO`](mhrima-server.py#L330), [`IndexedFileDTO`](mhrima-server.py#L678)

---

## 1. GET /status

```
┌──────────┬────────────────────────────────────────────────────────┐
│ route    │ GET /status/                                           │
│ screen   │ Overview → Status                                      │
│ today    │ 200, your object, 2 fields missing, 2 values hardcoded │
│ expected │ 200 OK, the same object + embed_model and watching     │
└──────────┴────────────────────────────────────────────────────────┘
```

Contract in `mhrima-server.py`:

- you receive: nothing
- you answer: [`StatusOutputDTO`](mhrima-server.py#L704), [`IndexedFileDTO`](mhrima-server.py#L678)
- called from: [`get_status`](mhrima-server.py#L717)

### Where it shows

```
┌─ Overview ───────────────────────────────────────────────┐
│ Status                                                   │
│   Chunks indexed   1594          ◄── chunks_indexed      │
│   Files indexed    539           ◄── len(files)          │
│   Target project   /just_testing ◄── target_project      │
│   Chroma path      ...           ◄── chroma_path         │
│   Embedding model  not reported  ◄── embed_model         │
│   Ask model        qwen2.5:3b    ◄── ask_model           │
│   Code model       ...           ◄── code_model          │
│   Ollama backend   http://ollama:11434/justTesting       │
│   Watch mode       not reported  ◄── watching            │
└──────────────────────────────────────────────────────────┘
```

### Request

```
┌───────────┬──────┬─────────┐
│ parameter │ type │ example │
├───────────┼──────┼─────────┤
│ (none)    │      │         │
└───────────┴──────┴─────────┘
```

```bash
curl -i http://127.0.0.1:8000/status/
```

### Response today

```
HTTP/1.1 200 OK
content-type: application/json

{
  "chunks_indexed": 1594,
  "target_project": "/just_testing",
  "chroma_path": "/goinfre/mhrima/workspace/inception_of_context/chroma_db",
  "ask_model": "qwen2.5:3b",
  "code_model": "qwen2.5-coder:3b",
  "ollama_backend": "http://ollama:11434/justTesting",
  "files": [{ "name": "/goinfre/mhrima/workspace/inception_of_context/test.py", "chunks": 1 }, ...]
}
```

### Expected response

```
HTTP/1.1 200 OK
content-type: application/json

{
  "chunks_indexed": 1594,
  "target_project": "/goinfre/mhrima/workspace/inception_of_context",
  "chroma_path": "/goinfre/mhrima/workspace/inception_of_context/chroma_db",
  "ask_model": "qwen2.5:3b",
  "code_model": "qwen2.5-coder:3b",
  "ollama_backend": "http://127.0.0.1:11434",
  "embed_model": "sentence-transformers/all-MiniLM-L6-v2",
  "watching": true,
  "files": [{ "name": "/goinfre/mhrima/workspace/inception_of_context/Makefile", "chunks": 1 }, ...]
}
```

### What to change

```
┌───────────────────────────────────────────────────────────┬─────────────────────────────────────────────┬─────────────────────────────────┐
│ field                                                     │ today                                       │ expected                        │
├───────────────────────────────────────────────────────────┼─────────────────────────────────────────────┼─────────────────────────────────┤
│ chunks_indexed, chroma_path, ask_model, code_model, files │ ok                                          │ nothing to do                   │
│ target_project                                            │ hardcoded "/just_testing"                   │ the folder given to the indexer │
│ ollama_backend                                            │ hardcoded "http://ollama:11434/justTesting" │ the Ollama URL really used      │
│ embed_model                                               │ missing                                     │ the embedder model name         │
│ watching                                                  │ missing                                     │ true while the watcher runs     │
└───────────────────────────────────────────────────────────┴─────────────────────────────────────────────┴─────────────────────────────────┘
```

```python
# p2/routers/status.py:37
"target_project": "/just_testing",  # You can modify this if needed

# p2/routers/status.py:41
"ollama_backend": "http://ollama:11434/justTesting",  # You can modify this if needed
```

### Check your fix

```bash
curl -s -w '\nHTTP %{http_code}\n' http://127.0.0.1:8001/status
```

Today (shortened):

```
{"chunks_indexed":1594,"target_project":"/just_testing", ... ,"embed_model":null,"watching":null}
HTTP 200
```

Fixed: `embed_model` and `watching` are no longer `null`, and the Overview stops showing "not reported".

---

## 2. GET /events

```
┌──────────┬─────────────────────────────────────────────────────────────┐
│ route    │ GET /events                                                 │
│ screen   │ Overview → Live activity                                    │
│ today    │ 404 Not Found                                               │
│ expected │ 200 OK, text/event-stream, one IndexEventDTO per data: line │
└──────────┴─────────────────────────────────────────────────────────────┘
```

Contract in `mhrima-server.py`:

- you receive: nothing
- you answer: [`IndexEventDTO`](mhrima-server.py#L864)
- called from: [`stream_events`](mhrima-server.py#L873)

### Where it shows

```
┌─ Overview ─────────────────────────────────────────────┐
│ Live activity                   Streaming index events │
│   indexed   notes/service.py   4 chunks   12:01:03     │
│   modified  main.py            2 chunks   12:01:09     │
│   deleted   old.py             0 chunks   12:01:15     │
└────────────────────────────────────────────────────────┘
```

### Request

```
┌───────────┬──────┬─────────┐
│ parameter │ type │ example │
├───────────┼──────┼─────────┤
│ (none)    │      │         │
└───────────┴──────┴─────────┘
```

```bash
curl -N http://127.0.0.1:8000/events
```

### Response today

```
HTTP/1.1 404 Not Found
content-type: application/json

{"detail":"Not Found"}
```

### Expected response

```
HTTP/1.1 200 OK
content-type: text/event-stream

data: {"id": "a1", "kind": "indexed", "path": "/abs/proj/notes/service.py", "chunk_count": 4, "at": 1789358321.9}

data: {"id": "a2", "kind": "deleted", "path": "/abs/proj/old.py", "chunk_count": 0, "at": 1789358330.1}
```

### What to change

The stream stays open. Send one event each time your indexer or watcher changes a file (for example where `p1/monitor.py` prints "Added new chunks" or "Deleted chunks"):

```
┌─────────────┬────────┬─────────────────────────────────────────────────────┐
│ field       │ type   │ value                                               │
├─────────────┼────────┼─────────────────────────────────────────────────────┤
│ id          │ string │ unique                                              │
│ kind        │ string │ indexed, modified, deleted, ignored, patched, error │
│ path        │ string │ absolute file path (for error: the message)         │
│ chunk_count │ int    │ chunks stored for that file after the change        │
│ at          │ float  │ unix time in seconds                                │
└─────────────┴────────┴─────────────────────────────────────────────────────┘
```

```python
# one event on the wire
yield "data: " + json.dumps(event) + "\n\n"
```

### Check your fix

```bash
curl -N http://127.0.0.1:8001/events
```

Today:

```
{"detail":"AI agent GET /events answered 404: {\"detail\":\"Not Found\"}"}
```

Fixed: the connection stays open and a `data:` line appears when you save a file of the indexed folder.

---

## 3. GET /chunks

```
┌──────────┬───────────────────────────────────────────┐
│ route    │ GET /chunks?offset=<int>&limit=<int>      │
│ screen   │ ChromaDB Explorer                         │
│ today    │ 404 Not Found                             │
│ expected │ 200 OK, application/json, ChunksOutputDTO │
└──────────┴───────────────────────────────────────────┘
```

Contract in `mhrima-server.py`:

- you receive: [`ChunksInputDTO`](mhrima-server.py#L753)
- you answer: [`ChunksOutputDTO`](mhrima-server.py#L758), [`StoredChunksDTO`](mhrima-server.py#L692), [`ChunkMetadataDTO`](mhrima-server.py#L683)
- called from: [`get_chunks`](mhrima-server.py#L766)

### Where it shows

```
┌─ ChromaDB Explorer ────────────────────────────────────────────────────────┐
│ 1–25 of 1594 chunks                    ◄── offset, limit, total            │
│                                    [ Previous ]  [ Next ]                  │
│ class   GeneralInfos     general_infos_object.py   3–4                     │
│ │       │                │                         └── start_line–end_line │
│ kind    qualified_name   file                                              │
│ ▼ click: the document                                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

### Request

```
┌────────────────┬──────┬─────────┐
│ parameter      │ type │ example │
├────────────────┼──────┼─────────┤
│ offset (query) │ int  │ 0       │
│ limit (query)  │ int  │ 25      │
└────────────────┴──────┴─────────┘
```

```bash
curl -i "http://127.0.0.1:8000/chunks?offset=0&limit=25"
```

### Response today

```
HTTP/1.1 404 Not Found
content-type: application/json

{"detail":"Not Found"}
```

### Expected response

The same chunk format as your `GET /files/{file_path}`, plus the page numbers:

```
HTTP/1.1 200 OK
content-type: application/json

{
  "chunks": {
    "ids": ["/abs/proj/p1/general_infos_object.py::GeneralInfos", ...],
    "documents": ["class GeneralInfos(BaseModel): ...", ...],
    "metadatas": [{ "file": "/abs/proj/p1/general_infos_object.py", "kind": "class",
                    "qualified_name": "GeneralInfos", "start_line": 3, "end_line": 4,
                    "content_hash": "..." }, ...]
  },
  "offset": 0,
  "limit": 25,
  "total": 1594
}
```

### What to change

Chroma returns this page as it is. Your chunks router exists but is not included:

```python
# p2/server.py:8
# app.include_router(chunks_router)

# a /chunks route
page = store.collection.get(offset=offset, limit=limit, include=["documents", "metadatas"])
return {"chunks": page, "offset": offset, "limit": limit, "total": store.collection.count()}
```

### Check your fix

```bash
curl -s -w '\nHTTP %{http_code}\n' "http://127.0.0.1:8001/chunks?offset=0&limit=25"
```

Today:

```
{"detail":"AI agent GET /chunks answered 404: {\"detail\":\"Not Found\"}"}
HTTP 404
```

Fixed: `HTTP 200`, and the Explorer pages through the collection.

---

## 4. POST /ask/stream

```
┌──────────┬────────────────────────────────────────────────────────────────┐
│ route    │ POST /ask/stream                                               │
│ screen   │ Editor → chat Ask mode, Ask → Ask LLM                          │
│ today    │ 200 OK, text/plain: the answer works, no sources               │
│ expected │ 200 OK, application/x-ndjson: a sources line, then token lines │
└──────────┴────────────────────────────────────────────────────────────────┘
```

Contract in `mhrima-server.py`:

- you receive: [`AiAgentAskInputDTO`](mhrima-server.py#L911)
- you answer: [`AskSourcesLineDTO`](mhrima-server.py#L918), [`AskTokenLineDTO`](mhrima-server.py#L923), [`AnswerSourceDTO`](mhrima-server.py#L330)
- called from: [`ask`](mhrima-server.py#L940)

### Where it shows

```
┌─ Editor → chat, Ask mode ──────────────────────────────────┐
│ you: what does GeneralInfos store?                         │
│                                                            │
│ ai: GeneralInfos keeps the target path  ◄── token lines    │
│   2 chunks used                         ◄── sources line   │
│   1 general_infos_object.py:3-4  GeneralInfos              │
└────────────────────────────────────────────────────────────┘
```

### Request

```
┌───────────────┬──────────┬───────────────────────────────────────────────────────────────────────┐
│ body field    │ type     │ example                                                               │
├───────────────┼──────────┼───────────────────────────────────────────────────────────────────────┤
│ query         │ string   │ the question, then "Earlier in this conversation:" and the last chats │
│ k             │ int      │ 5                                                                     │
│ session_id    │ string   │ the conversation id (nothing to store on your side)                   │
│ ignored_paths │ string[] │ see section 6                                                         │
└───────────────┴──────────┴───────────────────────────────────────────────────────────────────────┘
```

The conversation history is already inside `query`, nothing to change for it:

```bash
curl -i -N -X POST http://127.0.0.1:8000/ask/stream \
     -H 'Content-Type: application/json' \
     -d '{"query": "and which method sets the first one?\n\nEarlier in this conversation:\nuser: what does GeneralInfos store?\nassistant: It stores the target path and the chroma path.",
          "k": 5, "session_id": "8f3186fb46cc", "ignored_paths": []}'
```

### Response today

```
HTTP/1.1 200 OK
content-type: text/plain; charset=utf-8

The method that sets the first (or initial) chroma path is `set_chroma_path`.
```

### Expected response

```
HTTP/1.1 200 OK
content-type: application/x-ndjson

{"type": "sources", "sources": [{"rank": 1, "id": "/abs/proj/p1/general_infos_object.py::GeneralInfos", "file": "/abs/proj/p1/general_infos_object.py", "start_line": 3, "end_line": 4, "kind": "class", "qualified_name": "GeneralInfos", "score": 1.36, "content": "class GeneralInfos(BaseModel): ..."}]}
{"type": "token", "text": "The method that sets "}
{"type": "token", "text": "the target path is set_target_path."}
```

### What to change

```
┌─────────────────┬─────────────────────────────────────────┬──────────────────────────────────────────────┐
│ today           │ effect                                  │ change                                       │
├─────────────────┼─────────────────────────────────────────┼──────────────────────────────────────────────┤
│ text/plain      │ answer shown and stored, no sources     │ answer with application/x-ndjson             │
│ no sources line │ no "chunks used" list, nothing to click │ first line: the chunks you put in the prompt │
│ prompt          │ "hello" gets "I don't know"             │ let greetings get a normal reply             │
└─────────────────┴─────────────────────────────────────────┴──────────────────────────────────────────────┘
```

mhrima-server reads plain text and JSON lines, so nothing changes on our side when you switch.

```python
# p2/routers/rag.py:100 ask_stream, the same chunks and model, sent as JSON lines
def lines():
    yield json.dumps({"type": "sources", "sources": sources}) + "\n"
    for piece in llm_manager.stream_response(messages):
        yield json.dumps({"type": "token", "text": piece}) + "\n"

return StreamingResponse(lines(), media_type="application/x-ndjson")

# p2/routers/rag.py:111
system_prompt="answer the question based on the context provided, if the answer is not in the context, say 'I don't know'."
```

### Check your fix

```bash
curl -s -N -X POST http://127.0.0.1:8001/ask \
     -H 'Content-Type: application/json' -d '{"query": "what does GeneralInfos store?", "k": 3}'
```

Today:

```
{"type":"token","text":"I"}
{"type":"token","text":" don"}
{"type":"token","text":"'t"}
{"type":"token","text":" know"}
{"type":"token","text":"."}
```

Fixed: the first line is `{"type":"sources", ...}`.

---

## 5. POST /patch/loop

> **Done (2026-09-17).** You added `p2/routers/patch_loop.py`, and `p3_beta/` was rewritten
> behind it (see CHANGES.md). The route answers the shape below. The rest of this section is
> kept as the description of what it does.

```
┌──────────┬──────────────────────────────────────────────┐
│ route    │ POST /patch/loop                             │
│ screen   │ Editor → chat Agent mode, Patch Loop tab     │
│ today    │ 404 Not Found                                │
│ expected │ 200 OK, application/json, PatchLoopOutputDTO │
└──────────┴──────────────────────────────────────────────┘
```

Contract in `mhrima-server.py`:

- you receive: [`AiAgentPatchLoopInputDTO`](mhrima-server.py#L803)
- you answer: [`PatchLoopOutputDTO`](mhrima-server.py#L831), [`PatchAttemptDTO`](mhrima-server.py#L821), [`PatchFileDTO`](mhrima-server.py#L810), [`SanityDTO`](mhrima-server.py#L816)
- called from: [`run_patch_loop`](mhrima-server.py#L840)

### Where it shows

```
┌─ Editor → chat ─────────────────────────────────────────────────────────────┐
│ [ Ask ]  [ Agent ]                                                          │
│                                                                             │
│ you: add a rename method to GeneralInfos                                    │
│         │                                                                   │
│         ▼   POST /patch/loop      propose → write → validate, up to 3 times │
│         │                                                                   │
│         ▼   answer: summary + files changed, or rolled back                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

```
┌───────────────────────────┬────────────────────────────┐
│ screen                    │ called when                │
├───────────────────────────┼────────────────────────────┤
│ Editor → chat, Agent mode │ you send a message         │
│ Patch Loop tab            │ you click "Run patch loop" │
└───────────────────────────┴────────────────────────────┘
```

### Request

```
┌───────────────┬───────────────┬────────────────────────────────────────────────┐
│ body field    │ type          │ example                                        │
├───────────────┼───────────────┼────────────────────────────────────────────────┤
│ query         │ string        │ add a rename method to GeneralInfos            │
│ k             │ int           │ 8                                              │
│ target_path   │ string | null │ /goinfre/mhrima/workspace/inception_of_context │
│ ignored_paths │ string[]      │ see section 6                                  │
└───────────────┴───────────────┴────────────────────────────────────────────────┘
```

```bash
curl -i -X POST http://127.0.0.1:8000/patch/loop \
     -H 'Content-Type: application/json' \
     -d "{\"query\": \"add a rename method to GeneralInfos\", \"k\": 8, \"target_path\": \"$PWD\", \"ignored_paths\": []}"
```

### Response today

```
HTTP/1.1 404 Not Found
content-type: application/json

{"detail":"Not Found"}
```

### Expected response

`files` are your `PatchFile` objects (`p2/llm_manager.py`):

```
HTTP/1.1 200 OK
content-type: application/json

{
  "succeeded": true,
  "rolled_back": false,
  "files_touched": ["/abs/proj/p1/general_infos_object.py"],
  "summary": "Adds GeneralInfos.rename",
  "attempts": [
    {
      "number": 1,
      "summary": "Adds GeneralInfos.rename",
      "files": [{ "path": "/abs/proj/p1/general_infos_object.py", "op": "modify", "content": "<whole file>" }],
      "sanity": { "code": 0, "message": "" },
      "applied": true,
      "validation_passed": true,
      "validation_output": "8 passed"
    }
  ]
}
```

### What to change

Expose `p3_beta/patch_loop.py` as this route. The loop it has to run, and the bugs in it today:

```
for attempt 1..3
  answer_user_query     → CodePatch                        bug 7: empty prompt, then KeyError
  sanity_checker        → code != 0 : feedback, next try   bug 8: crashes on .md and on modify
  create_backup + write → files on disk (no accept/reject) bug 10: writes each change twice
  launch_tests          → green : return
                          red   : feedback, next attempt
3 attempts, never green → restore every touched file       restore_backup is never called
loop() itself                                              bug 9: crashes before attempt 1
```

```
┌────────────────────┬─────────────────────────────────────────────────────────────────────────────────┐
│ object             │ fields                                                                          │
├────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ PatchFileDTO       │ path, op (create | modify | delete), content (whole file)                       │
│ SanityDTO          │ code, message                                                                   │
│ PatchAttemptDTO    │ number, summary, files[], sanity, applied, validation_passed, validation_output │
│ PatchLoopOutputDTO │ succeeded, attempts[], rolled_back, files_touched[], summary                    │
└────────────────────┴─────────────────────────────────────────────────────────────────────────────────┘
```

### Check your fix

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST http://127.0.0.1:8001/patch/loop \
     -H 'Content-Type: application/json' -d "{\"query\": \"add a rename method to GeneralInfos\", \"targetPath\": \"$PWD\"}"
```

Today:

```
{"detail":"AI agent POST /patch/loop answered 404: {\"detail\":\"Not Found\"}"}
HTTP 404
```

Fixed: `HTTP 200` and the expected JSON.

---

## 6. ignored_paths in /ask/stream and /patch/loop

```
┌──────────┬────────────────────────────────────────────────────────────┐
│ route    │ POST /ask/stream and POST /patch/loop, field ignored_paths │
│ screen   │ Editor → file tree ignore toggles                          │
│ today    │ the field is dropped, ignored files still reach the model  │
│ expected │ no chunk, prompt, source or patch from an ignored path     │
└──────────┴────────────────────────────────────────────────────────────┘
```

Contract in `mhrima-server.py`:

- you receive: `ignored_paths` in [`AiAgentAskInputDTO`](mhrima-server.py#L911) and [`AiAgentPatchLoopInputDTO`](mhrima-server.py#L803)
- built by: [`find_ignored_paths`](mhrima-server.py#L612), from the conversation rules matched by [`is_path_ignored`](mhrima-server.py#L591)

### Where it shows

```
┌─ Editor → file tree ─────────────────────┐
│ ▸ node_modules    [x]  ◄── ignored       │
│ ▸ dist            [x]      by default    │
│ ▾ src             [ ]                    │
│     app.py        [ ]                    │
│ ▸ secret          [x]  ◄── user clicked  │
└──────────────────────────────────────────┘
```

### Request

```
┌───────────────┬──────────┬──────────────────────────────────────────────────────────────────┐
│ body field    │ type     │ example                                                          │
├───────────────┼──────────┼──────────────────────────────────────────────────────────────────┤
│ ignored_paths │ string[] │ ["/abs/proj/dist", "/abs/proj/node_modules", "/abs/proj/secret"] │
└───────────────┴──────────┴──────────────────────────────────────────────────────────────────┘
```

A file is ignored when it is one of these paths or inside one of them:

```
┌─────────────────────────────────────┬───────────────────────────────────┐
│ file                                │ with the list above               │
├─────────────────────────────────────┼───────────────────────────────────┤
│ /abs/proj/src/app.py                │ allowed                           │
│ /abs/proj/secret/key.txt            │ ignored (inside /abs/proj/secret) │
│ /abs/proj/node_modules/lib/index.js │ ignored                           │
└─────────────────────────────────────┴───────────────────────────────────┘
```

```python
def is_ignored(file_path, ignored_paths):
    for ignored_path in ignored_paths:
        if file_path == ignored_path or file_path.startswith(ignored_path + "/"):
            return True
    return False
```

### Response today

`AskRequest` has no `ignored_paths`, so the field is dropped. For this question your retrieval returns chunks from `_backup`, a folder the user would ignore:

```
POST /retrieve  {"query": "what does GeneralInfos store?", "k": 3}

[
  {"file": "/goinfre/.../p1/general_infos_object.py", "line": 54, "score": 1.34},
  {"file": "/goinfre/.../_backup/p2/deps.py", "line": 52, "score": 1.35},      ◄── inside an ignored path
  {"file": "/goinfre/.../p1/general_infos_object.py", "line": 3, "score": 1.36}
]
```

### Expected response

```
┌──────────────────┬──────────────────────────────────────────────────────────────────────────────────┐
│ route            │ must never                                                                       │
├──────────────────┼──────────────────────────────────────────────────────────────────────────────────┤
│ POST /ask/stream │ retrieve chunks from ignored files, put them in the prompt, list them as sources │
│ POST /patch/loop │ read, create, modify or delete a file there                                      │
└──────────────────┴──────────────────────────────────────────────────────────────────────────────────┘
```

### What to change

Add the field, and filter the chunks by their `file` metadata before building the prompt (`cosine_similarity_search` only returns documents, so query documents and metadatas together):

```python
# p2/routers/rag.py:92
class AskRequest(BaseModel):
    query: str
    k: int = 5
    session_id: str = ""
    ignored_paths: list[str] = []          # add

# p2/routers/rag.py:ask_stream, instead of store.cosine_similarity_search(...)
results = store.collection.query(query_embeddings=[query_embedding[0]], n_results=k, include=["documents", "metadatas"])
relevant_chunks = []
for document, metadata in zip(results["documents"][0], results["metadatas"][0]):
    if not is_ignored(metadata["file"], request.ignored_paths):
        relevant_chunks.append(document)
```

Run on your collection with `ignored_paths: ["<repo>/_backup"]` and k = 5:

```
kept:    p1/general_infos_object.py
dropped: _backup/p2/deps.py
kept:    p1/general_infos_object.py
kept:    p1/general_infos_object.py
dropped: _backup/p1/general_infos_object.py
chunks for the prompt: 3
```

mhrima-server already removes ignored files from the sources line it shows and stores, but only you can keep them out of the prompt.

### Check your fix

```bash
python3 - <<'EOF'
import json, os, urllib.request
ignored = [os.getcwd() + "/_backup"]
body = {"query": "what does GeneralInfos store?", "k": 5, "session_id": "", "ignored_paths": ignored}
request = urllib.request.Request("http://127.0.0.1:8000/ask/stream", json.dumps(body).encode(), {"Content-Type": "application/json"})
for line in urllib.request.urlopen(request):
    message = json.loads(line)
    if message["type"] == "sources":
        files = [source["file"] for source in message["sources"]]
        print("sources from ignored paths:", [f for f in files if any(f.startswith(path + "/") for path in ignored)])
EOF
```

Fixed: `sources from ignored paths: []` (it needs the JSON lines of section 4 to read the sources).

---

## 7. build_prompt_template returns an empty prompt

> **Fixed (2026-09-17).** `p3_beta/` was rewritten and `patcher.py` no longer exists, so the
> code quoted below is gone. The prompt is built in `p3_beta/prompt.py` (see CHANGES.md).

```
┌─────────┬──────────────────────────────────────────────┐
│ file    │ p3_beta/patcher.py:152                       │
│ affects │ every attempt of the patch loop              │
│ result  │ attempt 1: empty prompt, any retry: KeyError │
└─────────┴──────────────────────────────────────────────┘
```

### The code

```python
# p3_beta/patcher.py:148
return prompt_template.format(
    query=query,
    file_paths="\n".join(file_paths),
    context=context
) + attempt_message_template.format(attempt_message=attempt_message) if attempt_message else ""
#  └──────────────────────────── A ───────────────────────────────┘
#
# Python reads:   (A) if attempt_message else ""
# prompt_template (line 29) contains {attempt_message}, which .format() never receives
```

### What happens

```
┌────────────────────────────┬─────────────────────────────────────┐
│ attempt_message            │ result                              │
├────────────────────────────┼─────────────────────────────────────┤
│ ""           (attempt 1)   │ '' : the model gets an empty prompt │
│ "tests failed" (any retry) │ KeyError: 'attempt_message'         │
└────────────────────────────┴─────────────────────────────────────┘
```

### Reproduce

```bash
PYTHONPATH=.:p1 python - <<'EOF'
from p3_beta.patcher import Patcher

patcher = Patcher(".")
for attempt_message in ["", "tests failed"]:
    try:
        prompt = patcher.build_prompt_template("add a rename method", ["app.py"], "ctx", attempt_message)
        print(f"{attempt_message!r:16} -> prompt of {len(prompt)} characters")
    except Exception as error:
        print(f"{attempt_message!r:16} -> {type(error).__name__}: {error}")
EOF
```

### Output

```
''               -> prompt of 0 characters
'tests failed'   -> KeyError: 'attempt_message'
```

### Suggested fix

```python
# p3_beta/patcher.py:148   prompt_template already has a {attempt_message} section
return prompt_template.format(
    query=query,
    file_paths="\n".join(file_paths),
    context=context,
    attempt_message=attempt_message,
)
```

With this change the same script prints:

```
''               -> prompt of 3605 characters
'tests failed'   -> prompt of 3617 characters
```

---

## 8. sanity_checker crashes

> **Fixed (2026-09-17).** The checks now live in `p3_beta/sanity_check.py`, with one code per
> refusal and no crash on a non-Python file (see CHANGES.md).

```
┌─────────┬───────────────────────────────────────────────────────────────┐
│ file    │ p3_beta/patcher.py:178 and :217                               │
│ affects │ every patch that creates a non-Python file or modifies a file │
│ result  │ SyntaxError or TypeError instead of a sanity code             │
└─────────┴───────────────────────────────────────────────────────────────┘
```

### The code

```python
# p3_beta/patcher.py:178   contains_obvious_stub runs ast.parse on every file, even .md or .yml
tree = ast.parse(content)

# p3_beta/patcher.py:217   documents is already a list of str
existing_file_size[file.path] = sum(len(chunk["document"]) for chunk in existing_file_content.get("documents", []))
#                                        └── chunk is a str ──┘
```

### What happens

```
┌──────────────────────────────┬────────────────────────────────────────────┐
│ patch file                   │ result                                     │
├──────────────────────────────┼────────────────────────────────────────────┤
│ create NOTES.md (not Python) │ SyntaxError: invalid syntax                │
│ modify an indexed file       │ TypeError: string indices must be integers │
└──────────────────────────────┴────────────────────────────────────────────┘
```

### Reproduce

```bash
PYTHONPATH=.:p1 python - <<'EOF'
from p2.llm_manager import CodePatch, PatchFile
from p2.store import vector_store as store
from p3_beta.patcher import Patcher

check = Patcher(".").sanity_checker
indexed_file = store.get_all_files()[0]
patches = {
    "create NOTES.md": PatchFile(path="NOTES.md", op="create", content="Setup: run make."),
    "modify an indexed file": PatchFile(path=indexed_file, op="modify", content="def f():\n    return 1\n"),
}
for name, patch_file in patches.items():
    try:
        print(f"{name:24} -> returns {check(CodePatch(summary='s', files=[patch_file]))}")
    except Exception as error:
        print(f"{name:24} -> {type(error).__name__}: {error}")
EOF
```

### Output

```
create NOTES.md          -> SyntaxError: invalid syntax (<unknown>, line 1)
modify an indexed file   -> TypeError: string indices must be integers, not 'str'
```

### Suggested fix

```python
# p3_beta/patcher.py:213   only look for Python stubs in Python files
if (file.op == "create" or file.op == "modify") and file.path.endswith(".py") and self.contains_obvious_stub(file.content):
    return 8

# p3_beta/patcher.py:217
existing_file_size[file.path] = sum(len(document) for document in existing_file_content.get("documents", []))
```

With this change the same script prints:

```
create NOTES.md          -> returns 0
modify an indexed file   -> returns 9
```

---

## 9. loop crashes before the first attempt

> **Fixed (2026-09-17).** `p3_beta/patch_loop.py` was rewritten (see CHANGES.md).

```
┌─────────┬────────────────────────────────────┐
│ file    │ p3_beta/patch_loop.py:62           │
│ affects │ the whole patch loop               │
│ result  │ UnboundLocalError, no attempt runs │
└─────────┴────────────────────────────────────┘
```

### The code

```python
# p3_beta/patch_loop.py:8
feedback = ""                                   # module variable

def loop(query: str):
    for iteration in range(3):
        response = patcher_instance.answer_user_query(query, attempt_message=feedback)   # line 62: read
        ...
            feedback = SANITY_CHECK_DESCRIPTIONS[sanity_result]                          # line 66: write
#
# loop() writes feedback, so Python makes feedback local to loop():
# line 62 reads it before any value is set
```

### What happens

```
┌────────────────────────┬────────────────────┐
│ step                   │ result             │
├────────────────────────┼────────────────────┤
│ loop("...") called     │ iteration 1 starts │
│ line 62 reads feedback │ UnboundLocalError  │
│ answer_user_query      │ never called       │
└────────────────────────┴────────────────────┘
```

### Reproduce

```bash
PYTHONPATH=.:p1:p3_beta python - <<'EOF'
import patch_loop

try:
    patch_loop.loop("add a rename method to GeneralInfos")
except Exception as error:
    print(f"{type(error).__name__}: {error}")
EOF
```

### Output

```
UnboundLocalError: cannot access local variable 'feedback' where it is not associated with a value
```

### Suggested fix

```python
# p3_beta/patch_loop.py:59
def loop(query: str):
    """Continuously prompt the user for a query and answer it using the code model."""
    feedback = ""
    for iteration in range(3):
```

With this change, and the model call replaced by a stub, the loop reaches its first attempt:

```
first attempt gets attempt_message = ''
loop() started its first attempt
```

---

## 10. loop writes each change twice

> **Fixed (2026-09-17).** Writing happens once, in `p3_beta/apply_safely.py` (see CHANGES.md).

```
┌─────────┬──────────────────────────────────────────────────────────────────┐
│ file    │ p3_beta/patch_loop.py:71-73                                      │
│ affects │ every patch that creates or deletes a file                       │
│ result  │ FileExistsError or FileNotFoundError after the change is written │
└─────────┴──────────────────────────────────────────────────────────────────┘
```

### The code

```python
# p3_beta/patch_loop.py:70
patcher_instance.create_backup(response, backup_dir="backups")
patcher_instance.atomic_replacement(response)   # already creates, modifies and deletes
patcher_instance.create_new_files(response)     # creates the same files again
patcher_instance.delete_files(response)         # deletes the same files again
```

### What happens

```
┌────────────────────┬──────────────────────┬──────────────────────┐
│ step               │ patch creates new.py │ patch deletes old.py │
├────────────────────┼──────────────────────┼──────────────────────┤
│ atomic_replacement │ new.py created       │ old.py deleted       │
│ create_new_files   │ FileExistsError      │ nothing to create    │
│ delete_files       │ never reached        │ FileNotFoundError    │
└────────────────────┴──────────────────────┴──────────────────────┘
```

### Reproduce

```bash
PYTHONPATH=.:p1 python - <<'EOF'
import tempfile
from p2.llm_manager import CodePatch, PatchFile
from p3_beta.patcher import Patcher

for op in ("create", "delete"):
    root = tempfile.mkdtemp()
    open(f"{root}/old.py", "w").write("B = 2\n")
    path = f"{root}/new.py" if op == "create" else f"{root}/old.py"
    patch = CodePatch(summary="s", files=[PatchFile(path=path, op=op, content="C = 3\n")])
    patcher = Patcher(root)
    step = "atomic_replacement"
    try:
        patcher.atomic_replacement(patch)
        step = "create_new_files"
        patcher.create_new_files(patch)
        step = "delete_files"
        patcher.delete_files(patch)
        print(f"{op:6}  all steps ok")
    except Exception as error:
        print(f"{op:6}  {step:18}  {type(error).__name__}")
EOF
```

### Output

```
create  create_new_files    FileExistsError
delete  delete_files        FileNotFoundError
```

### Suggested fix

```python
# p3_beta/patch_loop.py:70   atomic_replacement handles create, modify and delete
patcher_instance.create_backup(response, backup_dir="backups")
patcher_instance.atomic_replacement(response)
state, feedback = patcher_instance.launch_tests()
```

With only `atomic_replacement`, the same two patches give:

```
create  ok, files now: ['new.py', 'old.py']
delete  ok, files now: []
```

---

## 11. The watcher indexes .git

> **Fixed in your code (2026-09-17).** `EXCLUDED_DIRS` moved to `p1/utils.py`, and the watcher
> now skips hidden folders, the excluded folders and its own ChromaDB folder. The section below
> is the reason, kept for review.

```
┌─────────┬──────────────────────────────────────────────────────────────┐
│ file    │ p1/monitor.py:38                                             │
│ affects │ every /ask answer: git logs are in the collection            │
│ result  │ .git, node_modules, dist, ... files indexed after any change │
└─────────┴──────────────────────────────────────────────────────────────┘
```

### The code

```python
# p1/index.py:20   only the first walk (walk_target) uses this
EXCLUDED_DIRS = {"node_modules", ".git", "dist", "build", "venv", ".venv", "__pycache__"}

# p1/monitor.py:38   the watcher indexes every created / modified file, no folder check
def on_any_event(self, event):
    if event.is_directory:
        return
    if event.event_type == "modified":
        self._handle_file_modified(event)
```

### What happens

```
┌────────────────────┬─────────────────────────────┬────────────┐
│ step               │ code                        │ .git files │
├────────────────────┼─────────────────────────────┼────────────┤
│ first indexing     │ walk_target, p1/index.py:22 │ skipped    │
│ every change after │ Handler, p1/monitor.py:38   │ indexed    │
└────────────────────┴─────────────────────────────┴────────────┘
```

Your running server on this repo has 7 of them:

```
.git/FETCH_HEAD   .git/COMMIT_EDITMSG   .git/logs/HEAD   .git/logs/refs/heads/ide-mhrima   ...
```

### Reproduce

```bash
cd p1 && PYTHONPATH=.:.. python - <<'EOF'
import os, tempfile, threading, time
from chunker import Chunker
from db import VectorStore
from embedder import Embedder
from index import walk_target
from monitor import OnMyWatch

project, chroma = tempfile.mkdtemp(), tempfile.mkdtemp()
os.makedirs(f"{project}/.git")
open(f"{project}/app.py", "w").write("def add(a, b):\n    return a + b\n")
open(f"{project}/.git/COMMIT_EDITMSG", "w").write("fix the patch loop\n")
print("first walk finds:", list(walk_target(project, chroma)))

store = VectorStore(chroma_path=chroma, collection_name="codebase")
watch = OnMyWatch(watchDirectory=project)
threading.Thread(target=watch.run, kwargs=dict(store=store, chunker=Chunker(), embedder=Embedder()), daemon=True).start()
time.sleep(2)
open(f"{project}/.git/COMMIT_EDITMSG", "w").write("another commit\n")
time.sleep(4)
print("indexed:", list(store.get_files_with_chunks_count()))
EOF
```

### Output

```
first walk finds: ['<project>/app.py']
Added new chunks: {'<project>/.git/COMMIT_EDITMSG::__file__'} for file: <project>/.git/COMMIT_EDITMSG
indexed: ['<project>/.git/COMMIT_EDITMSG']
```

### Worse: a log file inside the folder

Every line written to a log inside the folder is indexed again, and indexing writes a new line to
the indexer log, which is inside the folder too:

```
┌───────────────────────────────────────┬───────────────────────────────────────────────┐
│ step                                  │ result                                        │
├───────────────────────────────────────┼───────────────────────────────────────────────┤
│ a line is added to .logs/ai-agent.log │ indexer.log: "Updated chunk ... ai-agent.log" │
│ indexer.log changed                   │ indexer.log: "Updated chunk ... indexer.log"  │
│ indexer.log changed again             │ the same line again, forever                  │
└───────────────────────────────────────┴───────────────────────────────────────────────┘
```

```bash
mkdir -p /tmp/loop_project/.logs && printf 'def add(a, b):\n    return a + b\n' > /tmp/loop_project/calc.py
cd p1 && PYTHONPATH=.:.. PYTHONUNBUFFERED=1 timeout 70 python index.py /tmp/loop_project > /tmp/loop_project/.logs/indexer.log 2>&1 &
until grep -q '^Total chunks' /tmp/loop_project/.logs/indexer.log; do sleep 1; done; sleep 3
echo "INFO: GET /status 200 OK" >> /tmp/loop_project/.logs/ai-agent.log; sleep 3
echo "INFO: GET /files 200 OK"  >> /tmp/loop_project/.logs/ai-agent.log
for second in 10 20 30 40; do sleep 10; echo "after $second s: $(wc -l < /tmp/loop_project/.logs/indexer.log) lines"; done
grep -c 'Updated chunk.*indexer.log' /tmp/loop_project/.logs/indexer.log
```

```
after 10 s: 29 lines
after 20 s: 53 lines
after 30 s: 77 lines
after 40 s: 99 lines
91
```

Nothing else touches the folder: the indexer embeds its own log 91 times in 40 s, and the log grows
by about 750 bytes a second until it is stopped. Until the fix below is in, `make FOLDER=<folder>`
refuses a folder that contains this repository, because its `.logs/` would be inside.

### Suggested fix

```python
# p1/utils.py            move EXCLUDED_DIRS here so index.py and monitor.py share it
EXCLUDED_DIRS = {"node_modules", ".git", "dist", "build", "venv", ".venv", "__pycache__"}

# p1/index.py:20         replace the set by
from utils import EXCLUDED_DIRS

# p1/monitor.py:4
from pathlib import Path
from utils import EXCLUDED_DIRS, is_binary

# p1/monitor.py:38       skip the same folders as the first walk
def on_any_event(self, event):
    if event.is_directory:
        return
    relative_parts = Path(event.src_path).relative_to(self.target_dir).parts
    if any(part in EXCLUDED_DIRS or part.startswith(".") for part in relative_parts):
        return
```

With this change the same script prints:

```
first walk finds: ['<project>/app.py']
indexed: []
```

---

## 12. A renamed file leaves the index

> **Fixed in your code (2026-09-17).** `p1/monitor.py` indexes `event.dest_path` on a move.

```
┌─────────┬──────────────────────────────────────────────────────────┐
│ file    │ p1/monitor.py:47                                         │
│ affects │ every file renamed or moved, in the editor or by a patch │
│ result  │ old chunks deleted, the new path is never indexed        │
└─────────┴──────────────────────────────────────────────────────────┘
```

### The code

```python
# p1/monitor.py:47
elif event.event_type == "moved":
    self._handle_file_deleted(event)     # deletes the chunks of the old path   ok
    self._handle_file_created(event)     # reads event.src_path, the OLD path   wrong

# p1/utils.py:2
def is_binary(path: str, chunk_size: int = 1024) -> bool:
    try:
        with open(path, "rb") as f: ...
    except OSError:
        return True                      # a missing file counts as "binary"
```

### What happens

```
┌───────────────────────────┬────────────────────────────────────────────────────┐
│ step                      │ result                                             │
├───────────────────────────┼────────────────────────────────────────────────────┤
│ _handle_file_deleted(old) │ chunks of app.py deleted                           │
│ _handle_file_created(old) │ is_binary(app.py): the file is gone, OSError, True │
│                           │ "Skipping binary file: app.py"                     │
│ service.py                │ never indexed                                      │
└───────────────────────────┴────────────────────────────────────────────────────┘
```

### Reproduce

```bash
cd p1 && PYTHONPATH=.:.. python - <<'EOF'
import os, tempfile, threading, time
from chunker import Chunker
from db import VectorStore
from embedder import Embedder
from monitor import OnMyWatch

project, chroma = tempfile.mkdtemp(), tempfile.mkdtemp()
store = VectorStore(chroma_path=chroma, collection_name="codebase")
watch = OnMyWatch(watchDirectory=project)
threading.Thread(target=watch.run, kwargs=dict(store=store, chunker=Chunker(), embedder=Embedder()), daemon=True).start()
time.sleep(2)
open(f"{project}/app.py", "w").write("def add(a, b):\n    return a + b\n")
time.sleep(4)
print("before rename:", list(store.get_files_with_chunks_count()))
os.rename(f"{project}/app.py", f"{project}/service.py")
time.sleep(4)
print("after rename: ", list(store.get_files_with_chunks_count()))
EOF
```

### Output

```
before rename: ['<project>/app.py']
Deleted chunks: ['<project>/app.py::add'] for file: <project>/app.py
Skipping binary file: <project>/app.py
after rename:  []
```

### Suggested fix

```python
# p1/monitor.py:2
from watchdog.events import FileCreatedEvent, FileSystemEventHandler

# p1/monitor.py:47   index the new path
elif event.event_type == "moved":
    self._handle_file_deleted(event)
    self._handle_file_created(FileCreatedEvent(event.dest_path))
```

With this change the same script prints:

```
before rename: ['<project>/app.py']
Deleted chunks: ['<project>/app.py::add'] for file: <project>/app.py
after rename:  ['<project>/service.py']
```

---

## 13. Big chunks make answers take minutes

> **Fixed in your code (2026-09-17).** `p1/chunker.py` has `MAX_CHUNK_LINES = 40` and splits a
> file without functions into pieces (the Makefile chunk went from 9191 to 2570 characters).

```
┌─────────┬────────────────────────────────────────────────────────────────────┐
│ file    │ p1/chunker.py:106                                                  │
│ affects │ every /ask answer, and the context of the patch loop               │
│ result  │ a file without functions is one chunk: 152 s before the first word │
└─────────┴────────────────────────────────────────────────────────────────────┘
```

### The code

```python
# p1/chunker.py:126   no function found: the whole file becomes one chunk
if not chunks:
    chunks = [Chunk(id=f"{filepath}::__file__", file=filepath, kind="raw",
                    qualified_name="__file__", content=source, ...)]

# p1/chunker.py:112   a "function" found by the regex runs until the next match, however long
end_line = source[: matches[i + 1].start()].count("\n") if i + 1 < len(matches) else len(lines)
```

### What happens

```
┌──────────────────┬────────┬─────────────────────────────────┐
│ file             │ chunks │ biggest chunk                   │
├──────────────────┼────────┼─────────────────────────────────┤
│ Makefile         │ 1      │ raw, 9191 characters            │
│ requirements.txt │ 1      │ raw, 3178 characters            │
│ CHECK.md         │ 9      │ function_regex, 8749 characters │
└──────────────────┴────────┴─────────────────────────────────┘
```

`/ask` sends k=5 chunks. Two of these fill the model's 4096-token window, and on a CPU the model
reads the whole window before the first word. Your server on this repository (210 chunks),
qwen2.5-coder:3b, i5-7500 with 4 cores and no GPU:

```
┌────────────────────────────────────────────────┬────────────────────────────────────────────┬────────────┐
│ question                                       │ chunks found                               │ first word │
├────────────────────────────────────────────────┼────────────────────────────────────────────┼────────────┤
│ How does make install pick the models?         │ models.mk, Makefile, requirements.txt, ... │ 151.8 s    │
│ What does mhrima-server do with conversations? │ 5 functions of mhrima-server.py            │ 11.9 s     │
└────────────────────────────────────────────────┴────────────────────────────────────────────┴────────────┘
```

The dashboard shows nothing during those 152 s, so the answer looks stuck.

### Reproduce

```bash
cd p1 && PYTHONPATH=.:.. python - <<'EOF'
from chunker import Chunker
for name in ["../Makefile", "../requirements.txt", "../CHECK.md"]:
    chunks = Chunker().chunk_python_file(name, open(name).read())
    biggest = max(chunks, key=lambda chunk: len(chunk.content))
    print(f"{name[3:]:<17} {len(chunks):>3} chunks, biggest: {biggest.kind:<15} {len(biggest.content):>5} characters")
EOF
```

### Output

```
Makefile            1 chunks, biggest: raw              9191 characters
requirements.txt    1 chunks, biggest: raw              3178 characters
CHECK.md            9 chunks, biggest: function_regex   8749 characters
```

### Suggested fix

```python
# p1/chunker.py:20
MAX_CHUNK_LINES = 40

# p1/chunker.py   new method of Chunker: a range of lines becomes pieces of at most 40 lines
def split_lines(self, filepath, lines, name, kind, start_line, end_line):
    pieces = []
    for piece_start in range(start_line, end_line + 1, MAX_CHUNK_LINES):
        piece_end = min(piece_start + MAX_CHUNK_LINES - 1, end_line)
        content = "".join(lines[piece_start - 1 : piece_end])
        piece_name = name if piece_start == start_line else f"{name}@{piece_start}"
        pieces.append(Chunk(
            id=f"{filepath}::{piece_name}", file=filepath, kind=kind,
            qualified_name=piece_name, content=content,
            start_line=piece_start, end_line=piece_end,
            content_hash=hash_chunk(content),
        ))
    return pieces

# p1/chunker.py:118   in __chunk_with_regex_fallback, for each function found
chunks.extend(self.split_lines(filepath, lines, name, "function_regex", start_line, end_line))

# p1/chunker.py:126   no function found
if not chunks:
    chunks = self.split_lines(filepath, lines, "__file__", "raw", 1, len(lines))
```

With this change the same script prints:

```
Makefile            5 chunks, biggest: raw              2753 characters
requirements.txt    4 chunks, biggest: raw               902 characters
CHECK.md           30 chunks, biggest: function_regex   2074 characters
```

---

## 14. The embedder goes online at every start

> **Fixed in your code (2026-09-17).** `p1/embedder.py` looks for the model where it is really
> saved. With no network the embedder now loads in 3.2 s.

```
┌─────────┬───────────────────────────────────────────────────────────────────────┐
│ file    │ p1/embedder.py:25                                                     │
│ affects │ every start of the AI agent server and of the indexer                 │
│ result  │ the model on disk is seen as missing: about 5 s online, stuck offline │
└─────────┴───────────────────────────────────────────────────────────────────────┘
```

### The code

```python
# p1/embedder.py:25   looks in <cache_folder>/hub/
def _is_cached(self) -> bool:
    safe_name = self.model_name.replace("/", "--")
    expected = os.path.join(self.cache_folder, "hub", f"models--{safe_name}")
    return os.path.isdir(expected)
```

`cache_folder` is given to `HuggingFaceEmbeddings`, so the model is saved in
`~/.cache/huggingface/models--sentence-transformers--all-MiniLM-L6-v2`, without `hub/`.

### What happens

```
┌────────────────────┬──────────────────────────────────────────────────────────────────┐
│ step               │ result                                                           │
├────────────────────┼──────────────────────────────────────────────────────────────────┤
│ _is_cached()       │ False, the model folder is looked for in hub/                    │
│ _init_embeddings() │ HF_HUB_OFFLINE removed, "not cached yet, downloading once..."    │
│ with network       │ requests to huggingface.co: 15:52:37 to 15:52:42 in ai-agent.log │
│ without network    │ "Connection refused ... Retrying in 8s", not loaded after 120 s  │
└────────────────────┴──────────────────────────────────────────────────────────────────┘
```

### Reproduce

```bash
cd p1 && PYTHONPATH=.:.. python - <<'EOF'
import os
from embedder import Embedder
embedder = Embedder()
print("_is_cached():", embedder._is_cached())
print("model folder on disk:", os.path.isdir(os.path.expanduser("~/.cache/huggingface/models--sentence-transformers--all-MiniLM-L6-v2")))
EOF

# the same start without network
HTTPS_PROXY=http://127.0.0.1:9 HTTP_PROXY=http://127.0.0.1:9 PYTHONPATH=.:.. \
    timeout 120 python -c "from embedder import Embedder; Embedder(); print('loaded')"
```

### Output

```
[embedder] 'sentence-transformers/all-MiniLM-L6-v2' not cached yet — downloading once...
_is_cached(): False
model folder on disk: True

'[Errno 111] Connection refused' thrown while requesting HEAD https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/preprocessor_config.json
Retrying in 8s [Retry 5/5].
(no "loaded" after 120 s)
```

### Suggested fix

```python
# p1/embedder.py:28   the model folder is right in cache_folder
expected = os.path.join(self.cache_folder, f"models--{safe_name}")
```

With this change `_is_cached()` is `True`, and the start without network loads the model in 5.9 s.

---

## 15. A search on a new folder breaks every later search

```
┌─────────┬────────────────────────────────────────────────────────────────────────────────┐
│ files   │ p2/store.py:8, p1/index.py:67 (two processes, two Chroma clients)              │
│ affects │ /ask/stream, /retrieve, the patch loop, on a folder indexed for the first time │
│ result  │ 500 "Error creating hnsw segment reader: Nothing found on disk" until restart  │
└─────────┴────────────────────────────────────────────────────────────────────────────────┘
```

### The code

```python
# p2/store.py:8        the server process opens the collection
vector_store = VectorStore("./chroma_db", collection_name=collection_name)

# p1/index.py:67       the indexer is another process, with its own client on the same folder
store = VectorStore(chroma_path=chroma_path, collection_name=collection_name_from_path(target_path))
```

The subject asks for the opposite: "The server lives next to the watcher and shares its ChromaDB
collection through a single client per process."

### What happens

```
┌──────────────────────────────────────┬───────────────────────────────────────────────────────────┐
│ step                                 │ result                                                    │
├──────────────────────────────────────┼───────────────────────────────────────────────────────────┤
│ server searches the empty collection │ [] and its client remembers: no vectors on disk           │
│ indexer (other process) adds a chunk │ written to disk                                           │
│ server searches again                │ Error creating hnsw segment reader: Nothing found on disk │
│ indexer stops                        │ still the same error, until the server is restarted       │
└──────────────────────────────────────┴───────────────────────────────────────────────────────────┘
```

Seen in the dashboard: a question asked on a new folder before its first file was indexed, then
every later question answered `500`:

```
ai-agent:  16:32:27 WARNING 127.0.0.1:40090 - "POST /ask/stream HTTP/1.1" 500 Internal Server Error
{"detail":"Error executing plan: Internal error: Error creating hnsw segment reader: Nothing found on disk"}
```

### Reproduce

```bash
cd p1 && PYTHONPATH=.:.. python - <<'EOF'
import subprocess, sys, tempfile, time
from db import VectorStore

chroma = tempfile.mkdtemp()
server_store = VectorStore(chroma_path=chroma, collection_name="codebase")
print("server, empty collection: search =", server_store.cosine_similarity_search([0.1] * 384, n_results=1))

indexer = subprocess.Popen([sys.executable, "-c", f"""
import time
from db import VectorStore
store = VectorStore(chroma_path={chroma!r}, collection_name="codebase")
store.add(ids=["main.py::__file__"], documents=["print(1)"], embeddings=[[0.1] * 384], metadatas=[{{"file": "main.py"}}])
print("indexer: added 1 chunk, still running", flush=True)
time.sleep(40)
"""])
time.sleep(8)
try:
    print("server: search =", server_store.cosine_similarity_search([0.1] * 384, n_results=1))
except Exception as error:
    print("server: search failed:", error)
indexer.terminate(); indexer.wait()
try:
    print("server, indexer stopped: search =", server_store.cosine_similarity_search([0.1] * 384, n_results=1))
except Exception as error:
    print("server, indexer stopped: search failed:", error)
EOF
```

### Output

```
server, empty collection: search = []
indexer: added 1 chunk, still running
server: search failed: Error executing plan: Internal error: Error creating hnsw segment reader: Nothing found on disk
server, indexer stopped: search failed: Error executing plan: Internal error: Error creating hnsw segment reader: Nothing found on disk
```

### Suggested fix

Run the first indexing and the watcher inside the server, with the server's store and embedder.
It also saves the second copy of the embedding model: the indexer process uses about 510 MB.

```python
# p1/index.py          the loop of __main__ becomes a function
def index_and_watch(target_path, store, chunker, embedder):
    for filepath in walk_target(target_path, store.get_chroma_path()):
        ...                                   # the same body as today
    print(f"Total chunks indexed: {store.get_all_chunks_count()}")
    OnMyWatch(watchDirectory=target_path).run(store=store, chunker=chunker, embedder=embedder)

# p2/server.py         after "from .embidder_object import embedder"
import threading
from chunker import Chunker
from index import index_and_watch
from .store import vector_store
threading.Thread(target=index_and_watch, args=(target_path, vector_store, Chunker(), embedder), daemon=True).start()
```

`make FOLDER=<folder>` then starts only the server. With one client, the same steps work:

```python
store = VectorStore(chroma_path=tempfile.mkdtemp(), collection_name="codebase")
print("empty collection: search =", store.cosine_similarity_search([0.1] * 384, n_results=1))
threading.Thread(target=add_one_chunk).start()     # store.add(...) in another thread
time.sleep(2)
print("after the indexer thread: search =", store.cosine_similarity_search([0.1] * 384, n_results=1))
```

```
empty collection: search = []
indexer thread: added 1 chunk
after the indexer thread: search = ['print(1)']
```

---

## 16. The patch loop freezes the whole server

> **Fixed in your code (2026-09-17).** `p2/routers/patch_loop.py` uses `def`, so FastAPI runs it
> in a thread and the server keeps answering.

```
┌─────────┬───────────────────────────────────────────────────────────────┐
│ file    │ p2/routers/patch_loop.py:48                                   │
│ affects │ every route of the AI agent while a patch loop runs (minutes) │
│ result  │ GET /status answered after 68 s instead of 0.1 s              │
└─────────┴───────────────────────────────────────────────────────────────┘
```

### The code

```python
# p2/routers/patch_loop.py:48   async def, but loop() is normal blocking code
@router.post("/patch/loop", response_model=PatchLoopOutputDTO)
async def patch_loop(body: PatchLoopInput):
    return loop(query=body.query, ...)
```

An `async def` route runs inside the event loop. While `loop()` waits for the model and runs the
validation command, nothing else of the server is served: `/status`, `/files`, `/ask/stream` all wait.

### Measured

```
┌─────────────────────────────────────────────────┬──────────────┐
│ request                                         │ answer after │
├─────────────────────────────────────────────────┼──────────────┤
│ GET /status, no patch running                   │ 0.1 s        │
│ GET /status, sent 25 s into a patch loop        │ 68.3 s       │
│ the patch loop itself (3 attempts, rolled back) │ 93 s         │
└─────────────────────────────────────────────────┴──────────────┘
```

### Reproduce

```bash
# with the AI agent running on a small project
(sleep 25; curl -s -o /dev/null -w "status after %{time_total} s\n" http://127.0.0.1:8000/status/) &
curl -s -X POST http://127.0.0.1:8001/patch/loop -H 'Content-Type: application/json' \
    -d '{"query": "Add a rename method to NoteService.", "k": 5}' > /dev/null
wait
```

### Output

```
status after 68.345277 s
```

### Suggested fix

Declare the route with `def`. FastAPI then runs it in a thread and the server keeps answering.

```python
# p2/routers/patch_loop.py:48
@router.post("/patch/loop", response_model=PatchLoopOutputDTO)
def patch_loop(body: PatchLoopInput):
```

`p3_beta` already refuses a second loop at the same time, so two dashboards cannot patch at once.
