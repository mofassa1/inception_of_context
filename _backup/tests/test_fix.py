import json
import math
from types import SimpleNamespace

import pytest

from fix import ChunkStore, EmbedderAdapter, FixHandler
from p1.chunker import Chunker
from p1.core.events import EventBus
from p1.db import VectorStore
from p1.ignore import IgnoreRules
from p1.runtime import RuntimeInfo
from p2.retrieval import RetrievalService
from p2.routers.chat import answer_lines
from p2.schemas.chat import AnswerSourceDTO


class LengthEmbedder:
    """Stands in for the MiniLM `Embedder`: same method, no model download."""

    model_name = "fake"

    def create_embeddings(self, texts):
        vectors = []
        for text in texts:
            raw = [float(len(text) % 7 + 1), float(text.count("return") + 1), 1.0]
            norm = math.sqrt(sum(value * value for value in raw))
            vectors.append([value / norm for value in raw])
        return vectors


@pytest.fixture
def store(tmp_path):
    vector_store = VectorStore(str(tmp_path / "chroma"), collection_name="test")
    return ChunkStore(vector_store, RuntimeInfo())


@pytest.fixture
def handler(tmp_path, store):
    project = tmp_path / "project"
    project.mkdir()
    return FixHandler(
        str(project),
        store,
        Chunker(),
        EmbedderAdapter(LengthEmbedder()),
        IgnoreRules.build(),
        EventBus(),
    )


def stored_names(store, path):
    return sorted(
        metadata["qualified_name"]
        for metadata in store.get_file_chunks(str(path))["metadatas"]
    )


def test_a_removed_function_leaves_the_index(handler, store):
    source = handler.target_dir + "/service.py"
    with open(source, "w", encoding="utf-8") as handle:
        handle.write("def keep():\n    return 1\n\n\ndef drop():\n    return 2\n")
    handler._apply(source, removed=False, is_directory=False)

    assert stored_names(store, source) == ["drop", "keep"]

    with open(source, "w", encoding="utf-8") as handle:
        handle.write("def keep():\n    return 1\n")
    handler._apply(source, removed=False, is_directory=False)

    assert stored_names(store, source) == ["keep"]


def test_a_deleted_file_leaves_the_index(handler, store):
    source = handler.target_dir + "/gone.py"
    with open(source, "w", encoding="utf-8") as handle:
        handle.write("def soon_gone():\n    return 1\n")
    handler._apply(source, removed=False, is_directory=False)

    handler._apply(source, removed=True, is_directory=False)

    assert stored_names(store, source) == []
    assert store.file_chunk_counts() == {}


def test_a_move_forgets_the_source_and_indexes_the_destination(handler, monkeypatch):
    scheduled = []
    monkeypatch.setattr(
        handler,
        "_schedule",
        lambda path, removed, is_directory=False: scheduled.append((path, removed)),
    )

    handler.on_any_event(
        SimpleNamespace(
            event_type="moved",
            is_directory=False,
            src_path="/project/old.py",
            dest_path="/project/new.py",
        )
    )

    assert scheduled == [("/project/old.py", True), ("/project/new.py", False)]


def test_distances_are_reported_as_cosine_on_an_l2_collection(store):
    store.upsert(
        ids=["same", "orthogonal"],
        documents=["a", "b"],
        embeddings=[[1.0, 0.0], [0.0, 1.0]],
        metadatas=[{"file": "a.py"}, {"file": "b.py"}],
    )

    distances = {
        chunk["id"]: chunk["distance"] for chunk in store.search_chunks([1.0, 0.0], 2)
    }

    assert distances["same"] == pytest.approx(0.0, abs=1e-6)
    assert distances["orthogonal"] == pytest.approx(1.0, abs=1e-6)


def test_search_only_returns_chunks_inside_the_open_project(tmp_path):
    runtime = RuntimeInfo(target_project="/work/demo")
    store = ChunkStore(VectorStore(str(tmp_path / "chroma"), collection_name="scoped"), runtime)
    store.upsert(
        ids=["inside", "sibling", "outside"],
        documents=["a", "b", "c"],
        embeddings=[[0.0, 1.0], [1.0, 0.0], [1.0, 0.0]],
        metadatas=[
            {"file": "/work/demo/notes/service.py"},
            {"file": "/work/demo2/app.py"},
            {"file": "/work/claude-memo/memo.md"},
        ],
    )

    found = [chunk["id"] for chunk in store.search_chunks([1.0, 0.0], 3)]

    assert found == ["inside"]


def test_search_finds_nothing_when_the_open_project_is_not_indexed(tmp_path):
    runtime = RuntimeInfo(target_project="/work/empty")
    store = ChunkStore(VectorStore(str(tmp_path / "chroma"), collection_name="unindexed"), runtime)
    store.upsert(ids=["outside"], documents=["c"], embeddings=[[1.0, 0.0]], metadatas=[{"file": "/work/other.py"}])

    assert store.search_chunks([1.0, 0.0], 3) == []


class CannedStore:
    def search_chunks(self, _embedding, _k):
        return [
            {"id": f"f.py::{name}", "content": f"def {name}(): pass", "file": "f.py",
             "kind": "function", "qualifiedName": name, "startLine": line,
             "endLine": line, "distance": distance}
            for name, line, distance in (("best", 1, 0.1), ("second", 3, 0.4))
        ]


def test_context_blocks_are_numbered_by_rank_and_the_best_comes_last():
    retrieval = RetrievalService(
        CannedStore(), EmbedderAdapter(LengthEmbedder()), RuntimeInfo()
    )

    chunks = retrieval.collect("anything", 2)
    context = retrieval.render_context(chunks)

    assert [chunk["rank"] for chunk in chunks] == [1, 2]
    assert context[0].startswith("[2] ─── f.py")
    assert context[-1].startswith("[1] ─── f.py")


def test_ask_streams_the_chunks_it_used_before_the_answer():
    source = AnswerSourceDTO(
        rank=1, id="f.py::best", file="f.py", startLine=1, endLine=1,
        kind="function", qualifiedName="best", distance=0.1, content="def best(): pass",
    )

    lines = [json.loads(line) for line in answer_lines([source], iter(["It ", "works."]))]

    assert lines[0]["type"] == "sources"
    assert lines[0]["sources"][0]["qualifiedName"] == "best"
    assert [line["text"] for line in lines[1:]] == ["It ", "works."]


def test_a_name_repeated_in_one_file_gets_unique_chunk_ids():
    from fix import FixChunker

    source = "Example:\n\nfn run() {\n  show(1)\n}\n\nLater:\n\nfn run() {\n  show(2)\n}\n"

    ids = [chunk.id for chunk in FixChunker().chunk_python_file("/p/README.md", source)]

    assert len(ids) == len(set(ids))
    assert "/p/README.md::run" in ids
    assert "/p/README.md::run#2" in ids


def test_one_failing_file_does_not_stop_indexing_the_rest(tmp_path, monkeypatch):
    from p1 import service as service_module
    from p1.service import IndexingService

    good, bad = tmp_path / "good.py", tmp_path / "bad.py"
    good.write_text("def fine():\n    return 1\n", encoding="utf-8")
    bad.write_text("def broken():\n    return 2\n", encoding="utf-8")

    def sync_or_fail(store, chunker, embedder, path):
        if path.endswith("bad.py"):
            raise RuntimeError("chroma rejected the batch")
        return 1

    monkeypatch.setattr(service_module, "sync_file", sync_or_fail)
    events = EventBus()
    indexing = IndexingService(store=None, embedder=None, chunker=None, watcher=None,
                               event_bus=events, runtime=RuntimeInfo())

    files_indexed, chunks_indexed = indexing._index_files([str(bad), str(good)])

    assert (files_indexed, chunks_indexed) == (1, 1)
