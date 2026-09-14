"""Each test reproduces a bug found by stress-testing p1/ and p2/; the fixes live in fix/."""

import math
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from fix import ChunkStore, EmbedderAdapter, FixChunker, FixHandler
from fix.routers import router as fixed_router
from fix.index import index_folder
from fix.routers.file_detaid import ChunkOutOfDate, replace_chunk_lines
from p1.chunker import Chunker, hash_chunk
from p1.core.errors import register_error_handlers
from p1.core.events import EventBus
from p1.db import VectorStore
from p1.ignore import IgnoreRules
from p1.pipeline import embed_text
from p1.runtime import RuntimeInfo
from p2 import deps


class LengthEmbedder:
    model_name = "fake"

    def create_embeddings(self, texts):
        vectors = []
        for text in texts:
            raw = [float(len(text) % 7 + 1), float(text.count("return") + 1), 1.0]
            norm = math.sqrt(sum(value * value for value in raw))
            vectors.append([value / norm for value in raw])
        return vectors


NESTED_SOURCE = (
    "def outer():\n"
    "    def inner():\n"
    "        return 1\n"
    "    return inner()\n"
    "\n"
    "\n"
    "class Settings:\n"
    "    def load(self):\n"
    "        return {}\n"
    "\n"
    "    retries = 3\n"
)


def test_the_text_before_the_first_function_of_a_readme_is_indexed():
    readme = "# Ura\nUra is a small language.\n\nfn main() {}\n"

    chunks = FixChunker().chunk_python_file("/p/README.md", readme)

    assert chunks[0].qualified_name == "__preamble__"
    assert "Ura is a small language." in chunks[0].content


def test_a_property_and_its_setter_get_unique_chunk_ids():
    source = (
        "class User:\n"
        "    @property\n"
        "    def name(self):\n"
        "        return self._name\n"
        "\n"
        "    @name.setter\n"
        "    def name(self, value):\n"
        "        self._name = value\n"
    )

    ids = [chunk.id for chunk in FixChunker().chunk_python_file("/p/user.py", source)]

    assert len(ids) == len(set(ids))
    assert "/p/user.py::User.name#2" in ids


def test_python_files_get_no_preamble_chunk():
    chunks = FixChunker().chunk_python_file("/p/a.py", "import os\n\ndef run():\n    return 1\n")

    assert all(chunk.qualified_name != "__preamble__" for chunk in chunks)


def test_editing_one_chunk_keeps_nested_code_and_later_lines():
    load = next(c for c in Chunker().chunk_python_file("/p/s.py", NESTED_SOURCE) if c.qualified_name == "Settings.load")

    updated = replace_chunk_lines(
        NESTED_SOURCE, load.start_line, load.end_line, load.content_hash,
        "    def load(self):\n        return {'edited': True}\n",
    )

    assert "{'edited': True}" in updated
    assert updated.count("def inner") == 1
    assert "retries = 3" in updated


def test_editing_a_chunk_whose_file_changed_is_refused():
    with pytest.raises(ChunkOutOfDate):
        replace_chunk_lines("def a():\n    return 2\n", 1, 2, hash_chunk("def a():\n    return 1\n"), "x\n")


@pytest.fixture
def fixed_app(tmp_path):
    runtime = RuntimeInfo(target_project=str(tmp_path))
    store = ChunkStore(VectorStore(str(tmp_path / "chroma"), collection_name="fixes"), runtime)
    embedder = EmbedderAdapter(LengthEmbedder())
    llm = SimpleNamespace(ask_model="qwen2.5:3b", code_model="qwen2.5-coder:3b", ollama_host="http://ollama:11434")

    app = FastAPI()
    register_error_handlers(app)
    app.include_router(fixed_router)
    app.dependency_overrides.update({
        deps.get_vector_store: lambda: store,
        deps.get_embedder: lambda: embedder,
        deps.get_chunker: lambda: FixChunker(),
        deps.get_runtime_info: lambda: runtime,
        deps.get_llm_manager: lambda: llm,
    })

    from p1.pipeline import sync_file

    source = tmp_path / "settings.py"
    source.write_text(NESTED_SOURCE, encoding="utf-8")
    sync_file(store, FixChunker(), embedder, str(source))

    return SimpleNamespace(client=TestClient(app), app=app, store=store, source=source)


def test_chunks_modify_writes_the_new_content_without_corrupting_the_file(fixed_app):
    chunk_id = f"{fixed_app.source}::Settings.load"

    response = fixed_app.client.patch("/chunks_modify", json={
        "chunk_id": chunk_id,
        "content": "    def load(self):\n        return {'edited': True}\n",
    })

    written = fixed_app.source.read_text(encoding="utf-8")
    assert response.status_code == 200
    assert "{'edited': True}" in written
    assert written.count("def inner") == 1
    assert "retries = 3" in written


def test_chunks_modify_with_an_unknown_id_is_a_clear_404(fixed_app):
    response = fixed_app.client.patch("/chunks_modify", json={"chunk_id": "nope", "content": "x"})

    assert response.status_code == 404
    assert response.json()["detail"] == "chunk not found: nope"


def test_retrieve_needs_no_llm(fixed_app):
    """The fixture's llm is a stub with no methods: calling it would fail."""
    response = fixed_app.client.post("/retrieve", json={"query": "load settings", "k": 2})

    assert response.status_code == 200
    assert response.json()[0]["file"] == str(fixed_app.source)


def test_status_reports_real_values(fixed_app, tmp_path):
    body = fixed_app.client.get("/status/").json()

    assert body["target_project"] == str(tmp_path)
    assert body["ollama_backend"] == "http://ollama:11434"
    assert body["chunks_indexed"] > 0


def test_files_route_finds_an_absolute_path_given_with_a_single_slash(fixed_app):
    response = fixed_app.client.get(f"/files{fixed_app.source}")

    assert response.json()["file_path"] == str(fixed_app.source)
    assert response.json()["chunks"]["ids"]


def test_query_returns_the_answer_as_text(fixed_app):
    class AnsweringModel:
        ask_model = "qwen2.5:3b"

        def ensure_pulled(self, model_name):
            return None

        def build_messages(self, **parts):
            return [parts]

        def stream_answer(self, messages):
            yield from ["Settings", ".load", " returns", " a dict."]

    fixed_app.app.dependency_overrides[deps.get_llm_manager] = AnsweringModel

    body = fixed_app.client.get("/query", params={"user_content": "what does load return?"}).json()

    assert body == {"response": "Settings.load returns a dict."}


def add_chunk_from_another_project(fixed_app, text):
    embedder = EmbedderAdapter(LengthEmbedder())
    fixed_app.store.upsert(
        ids=["/elsewhere/package.json::__preamble__"],
        documents=[text],
        embeddings=[embedder.embed_one(text)],
        metadatas=[{"file": "/elsewhere/package.json", "start_line": 1, "end_line": 1}],
    )


def test_retrieve_only_returns_files_of_the_open_project(fixed_app):
    add_chunk_from_another_project(fixed_app, "load settings")

    body = fixed_app.client.post("/retrieve", json={"query": "load settings", "k": 10}).json()

    assert body
    assert {source["file"] for source in body} == {str(fixed_app.source)}


def test_query_only_reads_chunks_of_the_open_project(fixed_app):
    add_chunk_from_another_project(fixed_app, "what is in package.json?")
    contexts = []

    class RecordingModel:
        ask_model = "qwen2.5:3b"

        def ensure_pulled(self, model_name):
            return None

        def build_messages(self, **parts):
            contexts.append(parts["context"])
            return [parts]

        def stream_answer(self, messages):
            yield "ok"

    fixed_app.app.dependency_overrides[deps.get_llm_manager] = RecordingModel

    fixed_app.client.get("/query", params={"user_content": "what is in package.json?"})

    assert "def load" in contexts[0]
    assert "package.json" not in contexts[0]


def test_the_watcher_embeds_edits_the_same_way_the_indexer_does(tmp_path):
    store = ChunkStore(VectorStore(str(tmp_path / "chroma"), collection_name="watch"), RuntimeInfo())
    embedder = EmbedderAdapter(LengthEmbedder())
    project = tmp_path / "project"
    project.mkdir()
    handler = FixHandler(str(project), store, FixChunker(), embedder, IgnoreRules.build(), EventBus())

    source = project / "tool.py"
    source.write_text("def tool():\n    return 1\n", encoding="utf-8")
    handler._apply(str(source), removed=False, is_directory=False)

    chunk = FixChunker().chunk_python_file(str(source), source.read_text(encoding="utf-8"))[0]
    stored = store.collection.get(ids=[chunk.id], include=["embeddings"])["embeddings"][0]

    assert list(stored) == pytest.approx(embedder.embed([embed_text(chunk)])[0])


def test_the_cli_survives_a_non_utf8_file_and_picks_up_edits(tmp_path):
    project = tmp_path / "project"
    project.mkdir()
    (project / "legacy.txt").write_bytes("caf\xe9\n".encode("latin-1"))
    service = project / "service.py"
    service.write_text("def create():\n    raise ValueError('title is required')\n", encoding="utf-8")
    chroma = str(tmp_path / "chroma_db")

    index_folder(str(project), chroma_path=chroma, embedder=LengthEmbedder(), watch=False)
    service.write_text("def create():\n    raise ValueError('TITLE MISSING')\n", encoding="utf-8")
    index_folder(str(project), chroma_path=chroma, embedder=LengthEmbedder(), watch=False)

    documents = VectorStore(chroma, collection_name="codebase").get_chunks_by_file(str(service))["documents"]
    assert any("TITLE MISSING" in document for document in documents)
    assert not any("title is required" in document for document in documents)
