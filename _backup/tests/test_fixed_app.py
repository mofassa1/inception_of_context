"""Tests that need the real app built by fix.create_app, in a throwaway folder."""

import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

REPOSITORY = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def working_directory(tmp_path_factory):
    folder = tmp_path_factory.mktemp("app")
    previous = os.getcwd()
    os.chdir(folder)
    yield folder
    os.chdir(previous)


@pytest.fixture(scope="module")
def client(working_directory):
    from fix import create_app

    return TestClient(create_app())


def test_p1_modules_import_only_with_p1_on_the_import_path():
    environment = {key: value for key, value in os.environ.items() if key != "PYTHONPATH"}

    without_fix = subprocess.run(
        [sys.executable, "-c", "import p1.chunker"],
        cwd=REPOSITORY, env=environment, capture_output=True, text=True,
    )
    with_fix = subprocess.run(
        [sys.executable, "-c", "import fix, p1.chunker"],
        cwd=REPOSITORY, env=environment, capture_output=True, text=True,
    )

    assert "No module named 'general_infos_object'" in without_fix.stderr
    assert with_fix.returncode == 0, with_fix.stderr


def test_python_m_fix_offers_the_index_command():
    result = subprocess.run(
        [sys.executable, "-m", "fix", "--help"], cwd=REPOSITORY, capture_output=True, text=True
    )

    assert result.returncode == 0
    assert "index" in result.stdout


def test_the_fixed_routes_answer_before_the_original_ones(client):
    response = client.patch("/chunks_modify", json={"chunk_id": "nope", "content": "x"})

    assert response.status_code == 404
    assert response.json()["detail"] == "chunk not found: nope"


def test_files_chunks_is_taken_by_the_files_path_route_so_the_editor_uses_file_chunks(client):
    taken = client.get("/files/chunks", params={"path": "/project/app.py"}).json()
    editor = client.get("/file/chunks", params={"path": "/project/app.py"}).json()

    assert taken["file_path"] == "/chunks"
    assert editor == {"path": "/project/app.py", "chunks": []}


def test_the_index_is_opened_in_the_working_directory(client, working_directory):
    from p1.core.config import Settings
    from p2.store import vector_store

    assert vector_store.get_chroma_path() == str(working_directory / "chroma_db")
    assert Settings().chroma_path == str(working_directory / "chroma_db")


def test_the_watcher_starts_without_blocking(tmp_path):
    from fix import ChunkStore, EmbedderAdapter, FixChunker, FixWatcher
    from p1.core.events import EventBus
    from p1.db import VectorStore
    from p1.ignore import IgnoreRules
    from p1.runtime import RuntimeInfo

    watcher = FixWatcher()
    store = ChunkStore(VectorStore(str(tmp_path / "chroma"), collection_name="watch"), RuntimeInfo())

    watcher.start(str(tmp_path), store, FixChunker(), EmbedderAdapter(SimpleNamespace(model_name="none", create_embeddings=lambda texts: [])), IgnoreRules.build(), EventBus())
    running = watcher.is_running()
    watcher.stop()

    assert running
