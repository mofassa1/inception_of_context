"""
Inception-of-Context Architect — Flet frontend
================================================

This is a desktop/web GUI (built with Flet) that mirrors the 3 screens you
shared: Overview, Files, and Ask & Retrieve. It is UI-only for now — every
place that should talk to your FastAPI backend is marked with:

    # >>> FASTAPI HOOK <<<

and currently just prints to stdout + fills in fake/placeholder data so you
can see the layout working before wiring it up.

HOW TO RUN
----------
    pip install flet httpx
    python app.py

HOW TO WIRE IT TO YOUR FASTAPI SERVER
--------------------------------------
1. Set BASE_URL below to wherever uvicorn is serving your FastAPI app
   (e.g. "http://127.0.0.1:8000").
2. Use the `api` httpx.Client instance already created for you — just call
   api.get(...) / api.post(...) inside the functions marked with the
   FASTAPI HOOK comment.
3. For the streaming "Ask LLM" button, use httpx's `.stream()` method (see
   the `ask_llm_clicked` function below) to consume a StreamingResponse /
   SSE endpoint chunk by chunk and append each piece to the answer Text
   control, calling page.update() after each chunk.
4. Suggested endpoints (adjust names to match what you actually built):
     GET  /status                 -> overview stats + indexed files list
     GET  /files                  -> list of files in target project
     GET  /files/{path}           -> file content + chunk boundaries
     POST /retrieve {query, k}    -> nearest chunks (no LLM call)
     POST /ask/stream {query, k, session_id}  -> streamed LLM answer + sources
"""

import threading
import httpx
import flet as ft

# --------------------------------------------------------------------------
# CONFIG — point this at your running FastAPI server
# --------------------------------------------------------------------------
BASE_URL = "http://127.0.0.1:8000"

# Reusable HTTP client for all FastAPI calls. timeout=None because streaming
# LLM answers can take a while.
api = httpx.Client(base_url=BASE_URL, timeout=None)


# --------------------------------------------------------------------------
# Small reusable UI pieces
# --------------------------------------------------------------------------
def stat_card(label: str, value_text: ft.Text, highlighted: bool = False) -> ft.Container:
    """A single 'STATUS' box like CHUNKS INDEXED / TARGET PROJECT / etc.

    Takes an existing ft.Text control (not a raw string) so callers can keep
    a reference to it and update `.value` later, e.g. after a /status fetch.
    """
    return ft.Container(
        content=ft.Column(
            [
                ft.Text(label.upper(), size=11, color=ft.Colors.GREY_400, weight=ft.FontWeight.W_600),
                value_text,
            ],
            spacing=6,
        ),
        padding=16,
        border=ft.Border.all(1, ft.Colors.BLUE_400 if highlighted else ft.Colors.GREY_800),
        border_radius=8,
        bgcolor=ft.Colors.GREY_900,
        expand=True,
    )


def top_bar(chunks: int, ask_model: str, code_model: str) -> ft.Container:
    """Header row with app title + chip metadata + the green 'live' dot."""
    return ft.Container(
        content=ft.Row(
            [
                ft.Row(
                    [
                        ft.Text("Inception-of-Context", size=18, weight=ft.FontWeight.BOLD),
                        ft.Text("Architect", size=18, weight=ft.FontWeight.W_300, color=ft.Colors.GREY_400),
                        ft.Container(
                            content=ft.Text(f"chunks {chunks}", size=12),
                            padding=ft.Padding.symmetric(vertical=4, horizontal=10),
                            bgcolor=ft.Colors.GREY_800,
                            border_radius=12,
                        ),
                        ft.Container(
                            content=ft.Text(f"model {ask_model} / {code_model}", size=12),
                            padding=ft.Padding.symmetric(vertical=4, horizontal=10),
                            bgcolor=ft.Colors.GREY_800,
                            border_radius=12,
                        ),
                    ],
                    spacing=12,
                ),
                ft.Row(
                    [
                        ft.Icon(ft.Icons.CIRCLE, size=10, color=ft.Colors.GREEN_400),
                        ft.Text("live", size=12, color=ft.Colors.GREEN_400),
                    ],
                    spacing=6,
                ),
            ],
            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
        ),
        padding=ft.Padding.symmetric(vertical=12, horizontal=20),
        border=ft.Border.only(bottom=ft.BorderSide(1, ft.Colors.GREY_800)),
    )


# --------------------------------------------------------------------------
# TAB 1 — OVERVIEW
# --------------------------------------------------------------------------
def build_overview_tab(page: ft.Page) -> ft.Container:
    indexed_files = ft.Column(spacing=10)
    live_activity = ft.Text(
        "no file activity yet. edit a file in the target to see live updates.",
        italic=True,
        color=ft.Colors.GREY_500,
        size=13,
    )

    # Build each stat value as its own Text control up front, with a
    # placeholder, and keep a reference so refresh_status() can mutate
    # `.value` in place. This avoids the earlier bug where the grid was
    # built once from an empty `data = {}` before the fetch ever ran.
    chunks_value = ft.Text("—", size=15, color=ft.Colors.BLUE_200)
    target_value = ft.Text("—", size=15)
    chroma_value = ft.Text("—", size=15)
    ask_model_value = ft.Text("—", size=15)
    code_model_value = ft.Text("—", size=15)
    ollama_value = ft.Text("—", size=15)

    status_grid = ft.ResponsiveRow(
        [
            ft.Container(stat_card("Chunks Indexed", chunks_value, highlighted=True), col=3),
            ft.Container(stat_card("Target Project", target_value), col=3),
            ft.Container(stat_card("Chroma Path", chroma_value), col=3),
            ft.Container(stat_card("Ask Model", ask_model_value), col=3),
            ft.Container(stat_card("Code Model", code_model_value), col=3),
            ft.Container(stat_card("Ollama Backend", ollama_value), col=3),
        ],
        run_spacing=12,
        spacing=12,
    )

    def refresh_status(e=None):
        """Pull current status from the backend and update the tab in place."""
        print("[Overview] Refresh clicked -> GET /status")

        # >>> FASTAPI HOOK <<<
        try:
            resp = api.get("/status/")
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as ex:
            print(f"[Overview] Failed to reach backend: {ex}")
            return

        # Expected shape:
        # data = {
        #   "chunks_indexed": 35,
        #   "target_project": "/workspace",
        #   "chroma_path": "/workspace/.chroma",
        #   "ask_model": "qwen2.5:3b",
        #   "code_model": "qwen2.5-coder:3b",
        #   "ollama_backend": "http://ollama:11434",
        #   "files": [{"name": "README.md", "chunks": 1}, ...],
        # }

        chunks_value.value = str(data.get("chunks_indexed", "—"))
        target_value.value = data.get("target_project", "—")
        chroma_value.value = data.get("chroma_path", "—")
        ask_model_value.value = data.get("ask_model", "—")
        code_model_value.value = data.get("code_model", "—")
        ollama_value.value = data.get("ollama_backend", "—")

        files = data.get("files", [])
        indexed_files.controls.clear()
        max_chunks = max((f["chunks"] for f in files), default=1)
        for f in files:
            bar_width = 6 + int(80 * (f["chunks"] / max_chunks))
            indexed_files.controls.append(
                ft.Row(
                    [
                        ft.Text(f["name"], italic=True, color=ft.Colors.GREY_300, size=13, expand=True),
                        ft.Text(f"{f['chunks']} chunk" + ("s" if f["chunks"] != 1 else ""), size=12, color=ft.Colors.GREY_500),
                        ft.Container(width=bar_width, height=3, bgcolor=ft.Colors.BLUE_300, border_radius=2),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                )
            )
        page.update()

    refresh_button = ft.ElevatedButton(
        "Refresh",
        icon=ft.Icons.REFRESH,
        on_click=refresh_status,
    )

    content = ft.Column(
        [
            ft.Row([ft.Text("STATUS", weight=ft.FontWeight.BOLD, size=13, color=ft.Colors.GREY_400), refresh_button],
                   alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
            status_grid,
            ft.Container(height=10),
            ft.Text("INDEXED FILES", weight=ft.FontWeight.BOLD, size=13, color=ft.Colors.GREY_400),
            ft.Container(
                content=indexed_files,
                padding=16,
                border=ft.Border.all(1, ft.Colors.GREY_800),
                border_radius=8,
                bgcolor=ft.Colors.GREY_900,
            ),
            ft.Container(height=10),
            ft.Text("LIVE ACTIVITY", weight=ft.FontWeight.BOLD, size=13, color=ft.Colors.GREY_400),
            ft.Container(
                content=live_activity,
                padding=16,
                border=ft.Border.all(1, ft.Colors.GREY_800),
                border_radius=8,
                bgcolor=ft.Colors.GREY_900,
            ),
        ],
        spacing=10,
        scroll=ft.ScrollMode.AUTO,
    )

    # Populate once on load
    refresh_status()

    return ft.Container(content=content, padding=20, expand=True)


# --------------------------------------------------------------------------
# TAB 2 — FILES
# --------------------------------------------------------------------------
def build_files_tab(page: ft.Page) -> ft.Container:
    file_list_col = ft.Column(spacing=2)
    code_view = ft.Column(spacing=0, scroll=ft.ScrollMode.AUTO, expand=True)
    file_title = ft.Text("Select a file", size=13, weight=ft.FontWeight.BOLD)
    file_meta = ft.Text("", size=12, color=ft.Colors.GREY_500)

    selected_file = {"name": None}

    def load_file(file_name: str):
        """Fetch a single file's content + chunk boundaries from the backend."""
        print(f"[Files] File selected: {file_name} -> GET /files/{file_name}")
        selected_file["name"] = file_name

        # >>> FASTAPI HOOK <<<
        try:
            resp = api.get(f"/files/{file_name}")
            resp.raise_for_status()
            raw = resp.json()
        except httpx.HTTPError as ex:
            print(f"[Files] Failed to reach backend: {ex}")
            return

        # Your endpoint returns Chroma's native get()-style shape:
        # {
        #   "file_path": "...",
        #   "chunks": {
        #       "ids": [...],
        #       "documents": [...],       # chunk source text, parallel to ids
        #       "metadatas": [ {file, kind, qualified_name, start_line,
        #                       end_line, content_hash}, ... ],
        #   }
        # }
        # ids/documents/metadatas are parallel arrays (same index = same
        # chunk) rather than a list of per-chunk dicts, so zip them together
        # and sort by start_line since Chroma doesn't guarantee file order.
        file_path = raw.get("file_path", file_name)
        chunks_raw = raw.get("chunks", {})
        ids = chunks_raw.get("ids") or []
        documents = chunks_raw.get("documents") or []
        metadatas = chunks_raw.get("metadatas") or []

        chunks = sorted(
            zip(ids, documents, metadatas),
            key=lambda triple: triple[2].get("start_line", 0),
        )

        file_title.value = file_path

        total_lines = max((m.get("end_line", 0) for _, _, m in chunks), default=0)
        # Chunk documents are contiguous non-overlapping slices of the file,
        # so summing their encoded byte length approximates the file size
        # (there's no separate file-size field in this response).
        total_bytes = sum(len(doc.encode("utf-8")) for _, doc, _ in chunks)
        file_meta.value = f"{total_lines} lines · {total_bytes} bytes · {len(chunks)} chunks"

        code_view.controls.clear()
        for index, (chunk_id, document, metadata) in enumerate(chunks, start=1):
            start_line = metadata.get("start_line", 1)
            kind = metadata.get("kind", "")
            qualified_name = metadata.get("qualified_name", "")
            label = f"chunk #{index} — {kind} {qualified_name} — starts at line {start_line}"

            code_view.controls.append(
                ft.Container(
                    content=ft.Text(label, size=11, color=ft.Colors.BLUE_300),
                    padding=ft.Padding.only(top=10, bottom=2, left=4),
                )
            )

            line_no = start_line
            for line in document.split("\n"):
                code_view.controls.append(
                    ft.Row(
                        [
                            ft.Text(str(line_no), size=11, color=ft.Colors.GREY_600, width=30),
                            ft.Text(line, size=12, font_family="monospace", color=ft.Colors.GREY_200),
                        ]
                    )
                )
                line_no += 1

        page.update()

    def build_file_row(name: str, chunk_count: int) -> ft.Container:
        row = ft.Container(
            content=ft.Row(
                [
                    ft.Text(name, size=13, color=ft.Colors.GREY_200, expand=True),
                    ft.Text(str(chunk_count), size=12, color=ft.Colors.GREY_500),
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            padding=ft.Padding.symmetric(vertical=8, horizontal=10),
            border_radius=6,
            on_click=lambda e, n=name: load_file(n),
            ink=True,
        )
        return row

    def refresh_file_list(e=None):
        """Populate the left-hand file list from the backend."""
        print("[Files] Refresh clicked -> GET /files")

        # >>> FASTAPI HOOK <<<
        # resp = api.get("/files")
        # resp.raise_for_status()
        # files = resp.json()["files"]   # [{"name": "...", "chunks": N}, ...]

        # Placeholder list matching the screenshot:
        files = [
            {"name": "README.md", "chunks": 1},
            {"name": "ioc.config.yml", "chunks": 1},
            {"name": "main.py", "chunks": 7},
            {"name": "notes/__init__.py", "chunks": 1},
            {"name": "notes/cli.py", "chunks": 3},
            {"name": "notes/service.py", "chunks": 8},
            {"name": "notes/storage.py", "chunks": 9},
            {"name": "tests/test_service.py", "chunks": 6},
        ]

        file_list_col.controls.clear()
        for f in files:
            file_list_col.controls.append(build_file_row(f["name"], f["chunks"]))
        page.update()

        # Auto-select the first file so the panel isn't empty
        if files:
            load_file(files[0]["name"])

    left_panel = ft.Container(
        content=ft.Column(
            [
                ft.Row(
                    [ft.Text("FILES IN TARGET", weight=ft.FontWeight.BOLD, size=12, color=ft.Colors.GREY_400),
                     ft.IconButton(ft.Icons.REFRESH, icon_size=16, on_click=refresh_file_list)],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Column([file_list_col], scroll=ft.ScrollMode.AUTO, expand=True),
            ],
            spacing=8,
        ),
        width=220,
        padding=12,
        border=ft.Border.all(1, ft.Colors.GREY_800),
        border_radius=8,
        bgcolor=ft.Colors.GREY_900,
    )

    right_panel = ft.Container(
        content=ft.Column(
            [
                ft.Row([file_title, file_meta], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
                ft.Divider(color=ft.Colors.GREY_800, height=1),
                code_view,
            ],
            spacing=8,
            expand=True,
        ),
        padding=16,
        border=ft.Border.all(1, ft.Colors.GREY_800),
        border_radius=8,
        bgcolor=ft.Colors.GREY_900,
        expand=True,
    )

    refresh_file_list()

    return ft.Container(
        content=ft.Row([left_panel, right_panel], spacing=16, expand=True),
        padding=20,
        expand=True,
    )


# --------------------------------------------------------------------------
# TAB 3 — ASK & RETRIEVE
# --------------------------------------------------------------------------
def build_ask_tab(page: ft.Page) -> ft.Container:
    query_field = ft.TextField(
        hint_text="explain how NoteService.search works",
        multiline=True,
        min_lines=2,
        max_lines=4,
        border_color=ft.Colors.GREY_700,
    )
    k_field = ft.TextField(value="5", width=60, text_align=ft.TextAlign.CENTER)
    session_label = ft.Text("session —", size=12, color=ft.Colors.GREY_500)

    answer_text = ft.Text("", selectable=True, size=13)
    answer_box = ft.Container(
        content=ft.Column(
            [ft.Text("ANSWER", weight=ft.FontWeight.BOLD, size=12, color=ft.Colors.BLUE_300), answer_text],
            spacing=8,
        ),
        padding=16,
        border=ft.Border.all(1, ft.Colors.BLUE_900),
        border_radius=8,
        bgcolor=ft.Colors.GREY_900,
        visible=False,
    )

    sources_col = ft.Column(spacing=8)
    sources_header = ft.Text("", size=12, color=ft.Colors.GREY_500)

    session_id = {"value": None}

    def new_conversation(e):
        """Reset the session so the backend starts a fresh chat history."""
        session_id["value"] = None
        session_label.value = "session —"
        answer_box.visible = False
        sources_col.controls.clear()
        sources_header.value = ""
        print("[Ask] New conversation clicked -> session reset")

        # >>> FASTAPI HOOK <<<
        # If your backend issues session ids itself, you can instead call:
        # resp = api.post("/session/new")
        # session_id["value"] = resp.json()["session_id"]
        # session_label.value = f"session {session_id['value']}"

        page.update()

    def render_sources(sources: list[dict]):
        sources_col.controls.clear()
        sources_header.value = f"{len(sources)} sources used to answer"
        for s in sources:
            sources_col.controls.append(
                ft.Container(
                    content=ft.Row(
                        [
                            ft.Icon(ft.Icons.CHEVRON_RIGHT, size=14, color=ft.Colors.GREY_500),
                            ft.Container(
                                content=ft.Text(f"{s['file']}:{s['line']}", size=12, font_family="monospace"),
                                padding=ft.Padding.symmetric(vertical=2, horizontal=8),
                                bgcolor=ft.Colors.GREY_800,
                                border_radius=4,
                            ),
                            ft.Text(f"score {s['score']:.2f}", size=12, color=ft.Colors.GREY_500),
                        ],
                        spacing=8,
                    ),
                    padding=ft.Padding.symmetric(vertical=8, horizontal=10),
                    border=ft.Border.all(1, ft.Colors.GREY_800),
                    border_radius=6,
                )
            )

    def retrieve_clicked(e):
        """Retrieve-only: fetch nearest chunks, no LLM generation."""
        query = query_field.value or ""
        k = int(k_field.value or 5)
        print(f"[Ask] Retrieve clicked -> POST /retrieve  query={query!r} k={k}")

        # >>> FASTAPI HOOK <<<
        # resp = api.post("/retrieve", json={"query": query, "k": k})
        # resp.raise_for_status()
        # sources = resp.json()["sources"]   # [{"file": "...", "line": N, "score": 0.1}, ...]

        # Placeholder sources matching the screenshot:
        sources = [
            {"file": "notes/service.py", "line": 7, "score": 0.10},
            {"file": "tests/test_service.py", "line": 28, "score": 0.04},
            {"file": "tests/test_service.py", "line": 19, "score": -0.00},
            {"file": "main.py", "line": 1, "score": -0.07},
            {"file": "notes/service.py", "line": 24, "score": -0.08},
        ][:k]

        answer_box.visible = False
        render_sources(sources)
        page.update()

    def ask_llm_clicked(e):
        """Ask LLM: retrieve context + stream a generated answer from the backend."""
        query = query_field.value or ""
        k = int(k_field.value or 5)
        print(f"[Ask] Ask LLM clicked -> POST /ask/stream  query={query!r} k={k} session={session_id['value']}")

        answer_box.visible = True
        answer_text.value = ""
        page.update()

        # >>> FASTAPI HOOK (streaming) <<<
        # Runs in a background thread so it doesn't freeze the UI while streaming.
        # def worker():
        #     with api.stream(
        #         "POST",
        #         "/ask/stream",
        #         json={"query": query, "k": k, "session_id": session_id["value"]},
        #     ) as resp:
        #         for chunk in resp.iter_text():
        #             answer_text.value += chunk
        #             page.update()
        #     # After streaming finishes, fetch sources / session id, e.g. from a
        #     # trailing SSE "event: sources" message or a separate response header.
        # threading.Thread(target=worker, daemon=True).start()

        # Placeholder (non-streaming) behavior so the UI is testable right now:
        answer_text.value = (
            "NoteService.search works by taking a term as input, converting it to "
            "lowercase, and then searching for that term in the titles or bodies of "
            "all notes. It returns a list"
        )
        session_id["value"] = "24f441b8"
        session_label.value = f"session {session_id['value']}"
        render_sources(
            [
                {"file": "notes/service.py", "line": 7, "score": 0.10},
                {"file": "tests/test_service.py", "line": 28, "score": 0.04},
                {"file": "tests/test_service.py", "line": 19, "score": -0.00},
                {"file": "main.py", "line": 1, "score": -0.07},
                {"file": "notes/service.py", "line": 24, "score": -0.08},
            ][:k]
        )
        page.update()

    controls_row = ft.Row(
        [
            ft.Text("k", size=13, color=ft.Colors.GREY_400),
            k_field,
            ft.ElevatedButton("Retrieve", on_click=retrieve_clicked),
            ft.ElevatedButton(
                "Ask LLM",
                on_click=ask_llm_clicked,
                bgcolor=ft.Colors.BLUE_600,
                color=ft.Colors.WHITE,
            ),
            ft.OutlinedButton("New conversation", on_click=new_conversation),
            session_label,
        ],
        spacing=12,
        vertical_alignment=ft.CrossAxisAlignment.CENTER,
    )

    content = ft.Column(
        [
            ft.Text("RETRIEVE / ASK", weight=ft.FontWeight.BOLD, size=13, color=ft.Colors.GREY_400),
            ft.Container(
                content=query_field,
                padding=8,
                border=ft.Border.all(1, ft.Colors.GREY_800),
                border_radius=8,
                bgcolor=ft.Colors.GREY_900,
            ),
            controls_row,
            ft.Container(height=6),
            answer_box,
            ft.Container(height=6),
            ft.Text("SOURCES", weight=ft.FontWeight.BOLD, size=13, color=ft.Colors.GREY_400),
            sources_header,
            sources_col,
        ],
        spacing=10,
        scroll=ft.ScrollMode.AUTO,
    )

    return ft.Container(content=content, padding=20, expand=True)


# --------------------------------------------------------------------------
# APP ENTRY POINT
# --------------------------------------------------------------------------
def main(page: ft.Page):
    page.title = "Inception-of-Context Architect"
    page.theme_mode = ft.ThemeMode.DARK
    page.bgcolor = "#0a0a0d"  # ft.Colors only goes up to GREY_900 in recent Flet versions
    page.padding = 0
    page.window.width = 1000
    page.window.height = 750

    # Flet 0.80+ restructured Tabs: it now wraps an explicit TabBar (labels)
    # + TabBarView (per-tab content), instead of Tab(text=..., content=...).
    tabs = ft.Tabs(
        length=3,
        selected_index=0,
        expand=True,
        content=ft.Column(
            expand=True,
            controls=[
                ft.TabBar(
                    tabs=[
                        ft.Tab(label="Overview"),
                        ft.Tab(label="Files"),
                        ft.Tab(label="Ask & Retrieve"),
                    ],
                ),
                ft.TabBarView(
                    expand=True,
                    controls=[
                        build_overview_tab(page),
                        build_files_tab(page),
                        build_ask_tab(page),
                    ],
                ),
            ],
        ),
    )

    page.add(
        ft.Column(
            [
                top_bar(chunks=35, ask_model="qwen2.5:3b", code_model="qwen2.5-coder:3b"),
                tabs,
            ],
            spacing=0,
            expand=True,
        )
    )


if __name__ == "__main__":
    # view=ft.AppView.WEB_BROWSER also works if you'd rather serve this as a web app
    # alongside your FastAPI backend, e.g.: ft.run(main, view=ft.AppView.WEB_BROWSER, port=8550)
    # Note: ft.app() is deprecated as of Flet 0.80+ — use ft.run() instead.
    ft.run(main)