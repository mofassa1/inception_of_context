# Inception of Context

A local AI coding agent for a folder of your choice: it indexes the code, answers questions about
it with the files it used, and writes patches that it validates or rolls back. Everything runs on
your machine — the models through Ollama, the vectors in ChromaDB — inside an Electron IDE.

## Quick start

```bash
make install          # picks the models for this machine, creates .venv, npm install
make FOLDER=demo      # starts everything and opens the window
make logs             # the last run again, with colors
```

| You need | Why |
|---|---|
| Linux, `make` | the entry points |
| `uv`, Python 3.13 | `.venv` and the packages |
| Node 20.19+, `npm` | the Electron window (Electron 44, Vite 8) |
| Ollama running | the two models, `ollama serve` |
| ~4 GiB free disk, 8 GiB RAM | one 3B model resident, no GPU needed |
| Network, the first time only | pulls the models and the embedding model |

| View | What it is for |
|---|---|
| **Editor** | file tree, tabs, an editor, and the chat with the agent beside it |
| **Overview** | what is indexed, and what the watcher does, live |
| **ChromaDB** | every chunk in the store, page by page |
| **Ask** | a question, the answer, and the chunks it came from |
| **Patch** | run the patch loop and read every attempt |
| **the picker** | in the chat: switches the model of Ask or of Agent, and pulls a new one |

| Target | What it does |
|---|---|
| `make install` | models, `.venv`, `npm install` |
| `make FOLDER=<folder>` | starts the three parts and the window |
| `make logs` | the last log again |
| `make showcase` | Playwright plays every feature on a copy of `demo/`, at a human pace |
| `make tests` | `tests/test_index.py`, `tests/test_patch_loop.py` |
| `make clean` | `.venv`, `node_modules`, `dist`, caches |
| `make fclean` | `clean` plus `chroma_db`, `dashboard/sessions.sqlite3`, `models.mk`, `.logs`, `.showcase` |

## The map

```mermaid
flowchart LR
    W["Electron window<br/>dashboard/ui"] -->|HTTP| S["bridge :8001<br/>dashboard/bridge.py"]
    S -->|HTTP| A["AI agent :8000<br/>p2/api.py"]
    S --- DB[("dashboard/sessions.sqlite3<br/>conversations, chats, ignore rules")]
    A --- C[("chroma_db<br/>one collection per folder")]
    A -->|prompts| O["Ollama :11434<br/>ask model, code model"]
    A -->|reads and watches| F["your folder<br/>FOLDER=..."]
```

The window never talks to the AI agent directly. The bridge owns the file system, the
conversations and the ignore rules, and forwards the rest, checking every answer against its own
DTOs.

```
p1/         chunk a file, embed it, keep it in ChromaDB, watch the folder
p2/         the AI agent API: status, files, chunks, context, ask, events, patch
p3/         the patch loop: generate, check, apply, validate, roll back
dashboard/  bridge.py (:8001) and ui/ (React + Electron)
setup/      pick the models, then run everything (run.py)
tests/      the index and the patch loop
demo/       Taskboard, a tiny full-stack app to point FOLDER at
```

## How a run starts

`setup/run.py` owns the whole run. The Makefile only calls it.

```mermaid
flowchart TD
    M["make FOLDER=demo"] --> B["npm run build<br/>only when the UI changed"]
    B --> R["setup/run.py"]
    R --> K{"checks"}
    K -->|"a check fails"| X["one message, exit 1"]
    K -->|"folder ok, models pulled, ports 8000 and 8001 free"| A["start the AI agent"]
    A --> W1["wait for GET /status"]
    W1 --> S["start the bridge"]
    S --> W2["wait for GET /docs"]
    W2 --> U["start the Electron window"]
    U --> L["read every line of every part"]
    L -->|"window closed, Ctrl+C, SIGTERM, a part died"| T["SIGTERM to each process group"]
```

Every line of every part lands in one file, `.logs/<date>_<time>.log`, and `.logs/latest.log`
points at the newest one:

```
ai-agent:  17:04:11 INFO    indexed 629 chunks
bridge:    17:04:12 WARNING 127.0.0.1 - "GET /file?path=gone.py" 404 Not Found
run:       17:04:12 INFO    everything is running, close the window or press Ctrl+C to stop
```

The level comes from the line itself: the `LEVEL:` uvicorn writes, a traceback, an exception, or
the status code of a request. Colors are added in the terminal only, so the file stays plain text.

When the folder you open *contains this repository*, the log is written outside it. The watcher
indexes every file that changes, so a log inside the folder would index itself and never stop.

## How the code is indexed

```mermaid
flowchart TD
    S["the AI agent starts"] --> W["walk the folder"]
    W --> F{"keep this file?"}
    F -->|"node_modules, dist, build, venv, __pycache__,<br/>any dot folder, any binary file"| SK["skipped"]
    F -->|"text file"| CH["chunk it"]
    CH --> B{"256 chunks collected?"}
    B -->|"no"| W
    B -->|"yes"| E["embed the whole batch"]
    E --> UP["upsert into ChromaDB"]
    UP --> W
    W --> P["forget the files that no longer exist"]
    P --> WA["start the watcher"]
```

| Fact | Value |
|---|---|
| A chunk | one function or class in Python (its AST); in other files, one per function, class or top-level arrow function, plus the lines before the first one; 40 lines at most |
| Its id | `path::qualified_name`, made unique when a name repeats |
| Embedding | `sentence-transformers/all-MiniLM-L6-v2`, offline once cached |
| Distance | cosine, one collection per folder (`codebase_<sha256(path)[:16]>`) |
| Batch | 256 chunks per embed call and per upsert |
| Client | one ChromaDB client per process, shared by the API and the watcher |

The index is rebuilt at every start, so it can never drift from the folder. A start of this
repository (629 chunks) takes about 13 s, most of it real embedding work.

## How the watcher keeps it fresh

```mermaid
flowchart LR
    E["a file changes"] --> T{"event type"}
    T -->|"opened, closed"| I["ignored"]
    T -->|"deleted"| D["drop the chunks of that file"]
    T -->|"created, modified, moved"| R["chunk and embed it again"]
    D --> P["publish an event"]
    R --> P
    P --> SSE["GET /events"]
    SSE --> OV["Overview, live"]
```

`opened` and `closed` are ignored on purpose: reading a file in order to index it fires them, so
reacting to them would send the indexer back to the same file forever.

## How a question is answered

```mermaid
sequenceDiagram
    participant U as Chat
    participant S as bridge :8001
    participant A as AI agent :8000
    participant C as ChromaDB
    participant O as Ollama
    U->>S: POST /ask {query, k, conversationId}
    S->>S: store the question, read the last chats
    S->>A: POST /ask {query, k, ignored_paths, history}
    A->>C: search(embed(query), k)
    C-->>A: k chunks and their score
    A-->>S: {"type":"sources", ...}
    S-->>U: the sources, shown with the answer
    A->>O: rules + the chunks + the history + the question
    loop while the model writes
        O-->>A: a piece of text
        A-->>S: {"type":"token", "text": ...}
        S-->>U: the text appears
    end
    S->>S: store the answer with its sources
```

| Fact | Value |
|---|---|
| Chunks retrieved | `k = 5` by default |
| History sent | the last 5 chats, 500 characters each |
| Transport | NDJSON: one `sources` line, then one line per piece of text |
| Ignored paths | the ignore rules of that conversation, applied before the search |
| Stored sources | file, lines, score and content, copied into the chat |

A chat keeps its own sources, so an old answer still shows what it used even after the code
changed.

## Choosing the model

Two models run the project: one answers questions (**Ask**), one writes patches (**Agent**). The
picker sits next to the Ask/Agent toggle in the chat and changes the model of the mode you are in,
while the project runs.

```mermaid
flowchart TD
    P["the picker, next to Ask / Agent"] --> C{"is it installed?"}
    C -->|"no"| PL["POST /models/pull<br/>one JSON line per step"]
    PL --> B["the bar fills in the list"]
    B --> S["PUT /models"]
    C -->|"yes"| S
    S --> M["the AI agent keeps the new name"]
    M --> N["the next question uses it,<br/>nothing restarts"]
    M --> F["models.mk is written,<br/>so the next run starts with it"]
```

| Mode | What its model does | Field |
|---|---|---|
| **Ask** | answers questions about the code | `ask_model` |
| **Agent** | writes the patches of the patch loop | `code_model` |

The list holds what Ollama already has, plus the models `make install` knows about
(`setup/ollama_models.py`). An installed model shows the RAM it takes once loaded; a missing one
shows its download size and is pulled when you pick it, with the progress in the row. Nothing is
downloaded until you click.

## The editor

```mermaid
flowchart LR
    T["file tree<br/>GET /api/fs/list"] --> O["open<br/>GET /api/fs/read"]
    O --> E["CodeMirror<br/>+ the chunk ranges as an overlay"]
    E --> S["save<br/>PUT /api/fs/write"]
    S --> WA["the watcher sees the write"]
    WA --> IX["that file is indexed again"]
    IX --> E
```

| Action | Route |
|---|---|
| list a folder | `GET /api/fs/list` |
| read a file | `GET /api/fs/read` |
| save a file | `PUT /api/fs/write` |
| new file or folder | `POST /api/fs/create` |
| rename | `POST /api/fs/rename` |
| delete | `DELETE /api/fs/delete` |

These routes take an absolute path, so the bridge listens on `127.0.0.1` only. The tree shows
the folder you opened and hides `node_modules`, `.git` and `__pycache__`. The patch loop is the
strict one: it refuses any path outside the folder or ignored in the conversation.

## Conversations and ignore rules

```mermaid
erDiagram
    conversations ||--o{ chats : holds
    conversations ||--o{ ignore_rules : holds
    conversations {
        TEXT id PK
        TEXT directory
        TEXT title
        REAL created_at
        REAL updated_at
    }
    chats {
        INTEGER id PK
        TEXT conversation_id FK
        TEXT role "user or assistant"
        TEXT content
        TEXT mode "ask or agent"
        TEXT sources "JSON, as it was that day"
        REAL created_at
    }
    ignore_rules {
        INTEGER id PK
        TEXT conversation_id FK
        TEXT pattern
        INTEGER is_ignored
    }
```

Ignore rules belong to one conversation: a path switched off in the tree is dropped from the
search and refused by the patch loop, for that conversation only. `node_modules`, `.git`, `dist`,
`build`, `venv`, `.venv`, `__pycache__`, `chroma_db` and the usual caches are off from the start.

## The patch loop

```mermaid
flowchart TD
    Q["POST /patch/loop"] --> SE["search the k best chunks"]
    SE --> PR["prompt: the files the request names first,<br/>3 whole files, 6000 characters"]
    PR --> G["the code model answers<br/>a summary and a list of files"]
    G --> CK{"sanity checks"}
    CK -->|"refused"| FB["the reason goes back to the model"]
    FB --> N{"attempt number < 3?"}
    N -->|"yes"| PR
    N -->|"no"| KO["failed, the project is untouched"]
    CK -->|"ok"| SN["snapshot every file it touches"]
    SN --> AP["write path.ioc.tmp, then os.replace"]
    AP --> VA["run the validation command"]
    VA -->|"passed"| OK2["kept"]
    VA -->|"failed, or 120 s"| RB["restore content, mode and mtime"]
    RB --> N
```

The model is given whole files and answers whole files, never a diff. A patch is written to
`path.ioc.tmp` and moved with `os.replace`, so a file is never half written.

A 3B model has habits the loop works around:

- **It edits the first file it is shown.** The files the request names (`tasks/storage.py`, or
  `tasks.storage`) come first in the prompt, even when the search ranked another one higher.
- **It "tidies" lines nobody asked about**, and the tests catch it. The feedback of a red attempt
  carries the test output **and the original lines that attempt removed or changed**, with their
  line numbers, so the next attempt can put them back. They are plain lines, not a diff: shown a
  diff, a small model answers with one.
- **It wraps a file in a ```` ``` ```` block, or lists a file twice.** The block is unwrapped, and
  a duplicate entry that changes nothing is dropped, before the checks.
- **It can loop and never stop.** A patch answer is capped at 2048 tokens, a chat answer at
  1024, so a stuck model cannot hang a request; a cut answer is an invalid patch (14).

Every attempt is logged on one line, with the reason it failed: the last exception of the
validation output, such as `ImportError: cannot import name 'TaskService' from 'tasks.export'`.

**The refusals.** A patch that hits one of these is never applied; the reason is sent back to the
model as feedback for the next attempt.

| # | Refused because |
|---|---|
| 1 | a file contains the markers of the prompt |
| 2 | `create` on a file that already exists |
| 3 | a non-empty file would become `""`, `None` or `null` |
| 4 | a new function has only a stub body (`pass`, `...`, `return None`) |
| 5 | a file would shrink by more than 60 % |
| 6 | more than 3 files are touched |
| 7 | the patch has no file to change |
| 8 | nothing needs to change (the answer is the summary) |
| 9 | `modify` or `delete` on a file that does not exist |
| 10 | a path is outside the project |
| 11 | a path is ignored in this conversation |
| 12 | the same path is in the patch twice |
| 13 | the file to modify is not a text file |
| 14 | the model answer is not a valid patch |
| 15 | the request asks to create a file (`Create tests/test_x.py`) and the patch does not create it |

**The validation.** Put an `ioc.config.yml` at the root of the folder you open:

```yaml
validation:
  command: pytest -q {files}
```

`{files}` is replaced by the files the patch changed. Without that file, the baseline runs
`python -m py_compile {files}` on the changed `.py` files. The command runs in the folder, with a
120 s limit; on failure or timeout every file goes back to the exact bytes, mode and mtime it had.

## Live events

```mermaid
sequenceDiagram
    participant W as watchdog
    participant A as AI agent :8000
    participant S as bridge :8001
    participant O as Overview
    W->>A: created / modified / moved / deleted
    A->>A: index the file, or forget it
    A-->>S: data: {"kind":"indexed","path":"...","chunk_count":4}
    S-->>O: the same event, checked against the DTO
    O->>O: the counters and the activity list move
```

Server-Sent Events, not polling: the window is told when something happens and stays idle the rest
of the time.

## Routes

**AI agent, `:8000`** (`p2/api.py`)

| Route | Answers |
|---|---|
| `GET /status` | chunks indexed, folder, models, whether the watcher runs, files |
| `GET /models` | the two chosen models, and every model with its size |
| `PUT /models` | change the ask model, the code model, or both |
| `POST /models/pull` | NDJSON: the download of one model, step by step |
| `GET /files` | every indexed file with its number of chunks |
| `GET /file?path=` | the chunks of one file |
| `GET /chunks?offset=&limit=` | a page of chunks |
| `POST /context` | the k chunks closest to a query |
| `POST /ask` | NDJSON: the sources, then the answer as it is written |
| `GET /events` | SSE, what the watcher did |
| `POST /patch/loop` | the attempts, the sanity result, the validation, what was kept |

**The bridge, `:8001`** (`dashboard/bridge.py`)

| Route | Answers |
|---|---|
| `/api/fs/*` | list, read, write, create, rename, delete inside the folder |
| `GET POST /conversations` | list them, start one |
| `GET PATCH DELETE /conversations/{id}` | read it, add chats, delete it |
| `GET PUT /conversations/{id}/ignore-rules` | read and set the ignore rules |
| `/status` `/files` `/file` `/chunks` `/context` `/patch/loop` | forwarded, answer checked |
| `GET PUT /models`, `POST /models/pull` | forwarded: read the models, change them, pull one |
| `/ask` `/events` | forwarded as a stream, and stored on the way |

## Settings

| What | Where | Default |
|---|---|---|
| `ASK_MODEL`, `CODE_MODEL` | `models.mk`, written by `make install` and by the picker | picked from your RAM and GPU |
| `MODEL_THREADS` | environment | a third of your cores, at least 2 |
| `TARGET_PATH` | set by `setup/run.py` | `FOLDER=` |
| validation command | `ioc.config.yml` in the folder you open | `python -m py_compile {files}` |

`MODEL_THREADS` exists because Ollama took 8 of 20 cores for a single answer and the machine
crawled. More threads do not make it faster: on an i7-12700, 6, 8 and 12 threads all write about
10 tokens/s, a speed set by the memory, not by the cores. Fewer than 6 only slows down the reading
of the prompt.

## The showcase

`make showcase` is one take through every feature, for a screen recording: Playwright opens the
window and uses it like a person would, on a fresh copy of `demo/` in `.showcase/demo`.

```mermaid
flowchart LR
    C["copy demo/ to .showcase/demo"] --> R["setup/run.py --showcase<br/>AI agent, bridge"]
    R --> P["npx playwright test<br/>dashboard/ui/e2e"]
    P --> W["the window, fullscreen"]
    P --> V[".showcase/videos/*.mkv, ffmpeg x11grab<br/>chapters.json"]
    V --> X["setup/cut_video.py"]
    X --> M["*.mp4, the waits sped up"]
```

| Scene | What it shows |
|---|---|
| 01–02 | every folder opened, a file and its chunk bands, the overlay switched off and on |
| 03 | Overview: chunks, models, every indexed file |
| 04 | an edit in `models.py`, autosaved, re-indexed live |
| 05 | a file created, written, renamed, deleted |
| 06 | the ChromaDB explorer, page by page |
| 07 | Retrieve with k = 8, then Ask LLM and its sources |
| 08 | the chat: three questions, the sources, a file opened from one |
| 09 | models: `qwen2.5:0.5b` downloaded from the picker, the same question to it, back to the 3B |
| 10 | Agent mode: `tasks/export.py`, then its unit test, both validated by the test suite |
| 11 | the Patch tab: `TaskStore.count()` added to an existing file, every attempt, the JSON, the output |
| 12 | `tests/` ignored, a patch that breaks a test, the rollback, the first conversation again |
| 13 | the live activity of the whole take, then the closing card |

Scene 09 removes `qwen2.5:0.5b` from Ollama before the take, when the project does not run on
it, so the download shows every time; the take keeps it. Whatever happens, the models of
`models.mk` are put back at the end of the scene.

| Variable | Default | Effect |
|---|---|---|
| `SHOWCASE_SPEED` | `1` | `1.5` is faster, `0.8` slower: every pause, keystroke and mouse move |
| `SHOWCASE_RECORD` | `0` | `1` films the screen (X11, ffmpeg `x11grab`), then cuts it into an `.mp4` in `.showcase/videos` |
| `SHOWCASE_WAIT_SECONDS` | `6` | in the `.mp4`, how long a wait for a model lasts at most |
| `SHOWCASE_HEADLESS` | `0` | `1` plays it off-screen, a dry run (it cannot be recorded) |
| `SHOWCASE_SNAPSHOTS` | `0` | `1` saves a screenshot at every caption in `.showcase/snapshots` |
| `SHOWCASE_CAPTIONS` | `1` | `0` hides the captions |
| `SHOWCASE_TYPOS` | `1` | `0` types without the odd fixed typo |
| `SHOWCASE_ROLLBACK` | `1` | `0` skips scene 12, the longest |
| `SHOWCASE_SCENES` | `1-13` | `9-11` or `4,8` rehearses some scenes only; the cards always play |
| `SHOWCASE_PULL_MODEL` | `qwen2.5:0.5b` | the model scene 09 downloads |
| `SHOWCASE_ZOOM` | `1.25` | the zoom of the window, so the text reads on a phone |
| `SHOWCASE_SIZE` | `1920x1080` | the size of the window when headless; a recording is the size of the screen |
| `SHOWCASE_SEED` | `42` | the same seed moves the same way at every take |

```bash
SHOWCASE_RECORD=1 make showcase                        # plays fullscreen, films it, cuts the .mp4
SHOWCASE_HEADLESS=1 SHOWCASE_SCENES=1-8 make showcase  # a quick off-screen rehearsal
```

The answers and the patches are real, so a take is as long as the models are slow. Each wait
for a model is shown with a running clock and written to `.showcase/chapters.json`; the cut
(`setup/cut_video.py`, through the ffmpeg of `imageio-ffmpeg`) speeds every wait up so it lasts
a few seconds, while the clock keeps showing the real time. The rest plays at its real pace.
The run ends with the film, and `make showcase` fails if a scene did not see what it expected.

## When it does not work

| What you see | What it is |
|---|---|
| `port 8000 is already in use` | another run is open; close its window or Ctrl+C its terminal |
| `<model> is not pulled or Ollama is not running` | `ollama serve`, then `make install-models` |
| the first start hangs on the embedding model | it is downloaded once; after that every start is offline |
| answers are slow | the folder is large, or another run holds the cores |
| a patch takes minutes | on a CPU an attempt takes 1–2 min, and a red one is retried up to 3 times; the log says why each failed |
| the window opens empty | the UI was not built: `make FOLDER=<folder>` builds it when it changed |

## The subject

| Part | Where |
|---|---|
| Part 1 — index the code | `p1/` |
| Part 2 — serve it and answer | `p2/` |
| Part 3 — the patch loop | `p3/` |
| Chapter V — a real application | `dashboard/` |
