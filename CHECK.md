# CHECK

What the dashboard still needs from the AI agent server (:8000). mhrima-server
already uses your objects and names wherever they exist, so this list only has
what cannot be done on our side. Items 1–6 are routes, items 7–12 are bugs in the
current code. All outputs below were captured from your server on this repo.

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

## Index

```
┌────┬───────────────────────┬──────────────────────────────┬───────────────────────────────┐
│ #  │ item                  │ screen / affects             │ today                         │
├────┼───────────────────────┼──────────────────────────────┼───────────────────────────────┤
│ 1  │ GET /status           │ Overview                     │ 2 fields missing, 2 hardcoded │
│ 2  │ GET /events           │ Overview → Live activity     │ 404                           │
│ 3  │ GET /chunks           │ ChromaDB Explorer            │ 404                           │
│ 4  │ POST /ask/stream      │ chat Ask mode, Ask → Ask LLM │ text/plain, no sources        │
│ 5  │ POST /patch/loop      │ chat Agent mode, Patch Loop  │ 404                           │
│ 6  │ ignored_paths         │ file tree ignore toggles     │ field dropped                 │
│ 7  │ build_prompt_template │ patch loop                   │ empty prompt, KeyError        │
│ 8  │ sanity_checker        │ patch loop                   │ SyntaxError, TypeError        │
│ 9  │ loop()                │ patch loop                   │ UnboundLocalError             │
│ 10 │ loop() apply steps    │ patch loop                   │ FileExistsError               │
│ 11 │ watcher               │ index, every answer          │ .git indexed                  │
│ 12 │ watcher on rename     │ index                        │ file leaves the index         │
└────┴───────────────────────┴──────────────────────────────┴───────────────────────────────┘
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
