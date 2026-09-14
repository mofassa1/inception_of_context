import pytest

from p3.loop import PatchLoop


class FakeStore:
    def indexed_files(self):
        return []

    def set_file_chunk_count(self, *_):
        return None

    def file_chunk_counts(self):
        return {}

    def get_file_chunks(self, _):
        return {"ids": []}

    def delete_ids(self, _):
        return None


class ScriptedPatching:
    """Returns a canned proposal per attempt, recording the feedback it got."""

    def __init__(self, proposals):
        self.proposals = proposals
        self.store = FakeStore()
        self.feedback_seen = []

    def propose(self, query, k=5, feedback="", target_root=None):
        self.feedback_seen.append(feedback)
        return self.proposals[len(self.feedback_seen) - 1]


def proposal(path, content, summary="change", code=0, message=""):
    return {
        "summary": summary,
        "files": [{"path": str(path), "op": "modify", "content": content}],
        "sanity": {"code": code, "message": message},
    }


@pytest.fixture
def project(tmp_path):
    (tmp_path / "ioc.config.yml").write_text(
        "validation:\n  command: python -m compileall -q .\n", encoding="utf-8"
    )
    source = tmp_path / "app.py"
    source.write_text("VALUE = 1\n", encoding="utf-8")
    return tmp_path, source


def test_stops_on_the_first_attempt_that_validates(project):
    root, source = project
    patching = ScriptedPatching([proposal(source, "VALUE = 2\n")])
    result = PatchLoop(patching).run("bump", str(root))

    assert result.succeeded
    assert not result.rolled_back
    assert len(result.attempts) == 1
    assert source.read_text(encoding="utf-8") == "VALUE = 2\n"


def test_rolls_back_to_the_exact_pre_loop_state_after_three_failures(project):
    root, source = project
    broken = "def oops(\n"
    patching = ScriptedPatching([proposal(source, broken) for _ in range(3)])

    result = PatchLoop(patching).run("break it", str(root))

    assert not result.succeeded
    assert result.rolled_back
    assert len(result.attempts) == 3
    assert source.read_text(encoding="utf-8") == "VALUE = 1\n"


def test_feeds_the_validation_error_back_into_the_next_attempt(project):
    root, source = project
    patching = ScriptedPatching(
        [proposal(source, "def oops(\n"), proposal(source, "VALUE = 3\n")]
    )

    result = PatchLoop(patching).run("fix", str(root))

    assert result.succeeded
    assert patching.feedback_seen[0] == ""
    assert "failed" in patching.feedback_seen[1]
    assert "compileall" in patching.feedback_seen[1]


def test_a_sanity_rejection_is_never_written_to_disk(project):
    root, source = project
    patching = ScriptedPatching(
        [
            proposal(source, "WRECKED\n", code=12, message="placeholder"),
            proposal(source, "WRECKED\n", code=12, message="placeholder"),
            proposal(source, "WRECKED\n", code=12, message="placeholder"),
        ]
    )

    result = PatchLoop(patching).run("wreck", str(root))

    assert not result.succeeded
    assert all(not attempt.applied for attempt in result.attempts)
    assert source.read_text(encoding="utf-8") == "VALUE = 1\n"


def test_rollback_covers_files_only_a_later_attempt_touched(tmp_path):
    (tmp_path / "ioc.config.yml").write_text(
        "validation:\n  command: python -m compileall -q .\n", encoding="utf-8"
    )
    first = tmp_path / "one.py"
    second = tmp_path / "two.py"
    first.write_text("A = 1\n", encoding="utf-8")
    second.write_text("B = 2\n", encoding="utf-8")

    patching = ScriptedPatching(
        [
            proposal(first, "def bad(\n"),
            proposal(second, "def worse(\n"),
            proposal(second, "def still_bad(\n"),
        ]
    )

    result = PatchLoop(patching).run("break both", str(tmp_path))

    assert result.rolled_back
    assert first.read_text(encoding="utf-8") == "A = 1\n"
    assert second.read_text(encoding="utf-8") == "B = 2\n"


def test_honours_the_configured_validation_command(tmp_path):
    (tmp_path / "ioc.config.yml").write_text(
        "validation:\n  command: python -c \"import sys; sys.exit(1)\"\n",
        encoding="utf-8",
    )
    source = tmp_path / "app.py"
    source.write_text("VALUE = 1\n", encoding="utf-8")

    patching = ScriptedPatching([proposal(source, "VALUE = 2\n") for _ in range(3)])
    result = PatchLoop(patching).run("anything", str(tmp_path))

    assert not result.succeeded
    assert source.read_text(encoding="utf-8") == "VALUE = 1\n"
