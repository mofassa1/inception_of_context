import os
import stat
from dataclasses import dataclass, field

import pytest

from p3 import patch_loop
from p3.patch_loop import loop

SERVICE = """class NoteService:
    def __init__(self):
        self.notes = {}

    def add(self, title):
        note_id = len(self.notes) + 1
        self.notes[note_id] = title
        return note_id

    def get(self, note_id):
        return self.notes[note_id]
"""

COUNT_METHOD = """
    def count(self):
        return len(self.notes)
"""

BROKEN_METHOD = """
    def count(self)
        return len(self.notes)
"""

STUB_METHOD = """
    def rename(self, note_id, title):
        pass
"""

SHORT_SERVICE = "class NoteService:\n    def add(self, title):\n        return 1\n"

MAIN = 'from notes.service import NoteService\n\nprint(NoteService().add("groceries"))\n'


@dataclass
class File:
    path: str
    op: str
    content: str = ""


@dataclass
class Patch:
    summary: str = "a change"
    files: list = field(default_factory=list)


def make_patch(*files, summary="a change"):
    return Patch(summary=summary, files=[File(path, op, content) for path, op, content in files])


class Model:
    """Answers with the patches given, and remembers the prompts it received."""

    def __init__(self, answers):
        self.answers = list(answers)
        self.prompts = []

    def generate(self, prompt):
        self.prompts.append(prompt)
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


@pytest.fixture
def project(tmp_path):
    root = tmp_path / "project"
    (root / "notes").mkdir(parents=True)
    (root / "notes" / "service.py").write_text(SERVICE)
    (root / "main.py").write_text(MAIN)
    (root / "run.sh").write_text("#!/bin/sh\npython main.py\n")
    (root / "run.sh").chmod(0o755)
    (root / "ioc.config.yml").write_text("validation:\n  command: python -m py_compile {files}\n")
    return root


def search_of(project):
    def search(query, k, ignored_paths):
        return [
            {"file": str(project / "notes" / "service.py"), "start_line": 1},
            {"file": str(project / "main.py"), "start_line": 1},
        ]

    return search


def run_loop(project, answers, ignored=None, target_path=None):
    model = Model(answers)
    result = loop(
        query="a request",
        k=5,
        project_root=str(project),
        target_path=target_path or str(project),
        ignored_paths=[str(project / name) for name in (ignored or [])],
        search=search_of(project),
        generate=model.generate,
    )
    return result, model


def tree_state(root):
    state = {}
    for folder, folders, files in os.walk(root):
        state[os.path.relpath(folder, root) + "/"] = "folder"
        for name in files:
            path = os.path.join(folder, name)
            status = os.stat(path)
            state[os.path.relpath(path, root)] = (
                open(path, "rb").read(),
                stat.S_IMODE(status.st_mode),
                status.st_mtime_ns,
            )
    return state


def leftovers(root):
    found = []
    for folder, folders, files in os.walk(root):
        for name in folders + files:
            if name == "__pycache__" or name.endswith(".ioc.tmp"):
                found.append(os.path.join(folder, name))
    return found


def test_a_green_patch_stays(project):
    result, model = run_loop(
        project, [make_patch(("notes/service.py", "modify", SERVICE + COUNT_METHOD))]
    )

    assert result["succeeded"] is True
    assert result["rolled_back"] is False
    assert result["files_touched"] == ["notes/service.py"]
    assert (project / "notes" / "service.py").read_text() == SERVICE + COUNT_METHOD
    attempt = result["attempts"][0]
    assert len(result["attempts"]) == 1
    assert attempt["applied"] and attempt["validation_passed"]
    assert "$ python -m py_compile notes/service.py" in attempt["validation_output"]
    assert leftovers(project) == []


def test_the_prompt_carries_the_files_and_the_rules(project):
    _, model = run_loop(
        project, [make_patch(("notes/service.py", "modify", SERVICE + COUNT_METHOD))]
    )

    prompt = model.prompts[0]
    assert "<<<IOC FILE notes/service.py>>>" in prompt
    assert "class NoteService:" in prompt
    assert "Touch at most 3 files." in prompt


def test_three_red_attempts_bring_back_the_exact_tree(project):
    before = tree_state(project)
    broken = make_patch(
        ("notes/service.py", "modify", SERVICE + BROKEN_METHOD),
        ("tools/new/helper.py", "create", "def helper():\n    return 1\n"),
        ("run.sh", "delete", ""),
    )
    result, model = run_loop(project, [broken, broken, broken])

    assert result["succeeded"] is False
    assert result["rolled_back"] is True
    assert result["files_touched"] == ["notes/service.py", "run.sh", "tools/new/helper.py"]
    assert [attempt["applied"] for attempt in result["attempts"]] == [True, True, True]
    assert "SyntaxError" in result["attempts"][0]["validation_output"]
    assert "SyntaxError" in model.prompts[1]
    assert tree_state(project) == before
    assert leftovers(project) == []


@pytest.mark.parametrize(
    "files, ignored, code",
    [
        ([("notes/service.py", "modify", SERVICE + "# <<<IOC END>>>\n")], [], 1),
        ([("main.py", "create", "print('again')\n")], [], 2),
        ([("notes/service.py", "modify", "null")], [], 3),
        ([("notes/service.py", "modify", SERVICE + STUB_METHOD)], [], 4),
        ([("notes/service.py", "modify", SHORT_SERVICE)], [], 5),
        ([(f"new_{number}.py", "create", "x = 1\n") for number in range(4)], [], 6),
        ([], [], 7),
        ([("notes/missing.py", "modify", "x = 1\n")], [], 9),
        ([("../outside.py", "create", "x = 1\n")], [], 10),
        ([("notes/service.py", "modify", SERVICE + COUNT_METHOD)], ["notes"], 11),
        ([("main.py", "modify", MAIN + "\n"), ("./main.py", "modify", MAIN + "\n\n")], [], 12),
    ],
)
def test_a_refused_patch_writes_nothing(project, files, ignored, code):
    before = tree_state(project)
    refused = make_patch(*files)
    result, model = run_loop(project, [refused, refused, refused], ignored=ignored)

    assert [attempt["sanity"]["code"] for attempt in result["attempts"]] == [code, code, code]
    assert [attempt["applied"] for attempt in result["attempts"]] == [False, False, False]
    assert result["rolled_back"] is False
    assert result["files_touched"] == []
    assert "Why it failed" in model.prompts[1]
    assert tree_state(project) == before
    assert not (project.parent / "outside.py").exists()


def test_a_stub_already_in_the_file_is_allowed(project):
    store = "class Store:\n    def save(self):\n        pass\n"
    (project / "store.py").write_text(store)
    patch = make_patch(("store.py", "modify", store + "\n\ndef load():\n    return {}\n"))

    assert run_loop(project, [patch])[0]["succeeded"] is True


def test_a_question_returns_the_answer(project):
    before = tree_state(project)
    answer = make_patch(("", "noop", ""), summary="NoteService keeps the notes in a dict.")
    result, model = run_loop(project, [answer])

    assert result["summary"] == "NoteService keeps the notes in a dict."
    assert len(result["attempts"]) == 1
    assert result["attempts"][0]["sanity"]["code"] == 8
    assert result["attempts"][0]["files"] == []
    assert tree_state(project) == before


def test_an_unreadable_answer_is_retried_with_feedback(project):
    answers = [
        ValueError("the model did not answer a patch"),
        make_patch(("hello.py", "create", "print('hello')\n")),
    ]
    result, model = run_loop(project, answers)

    assert result["succeeded"] is True
    assert result["attempts"][0]["sanity"]["code"] == 14
    assert "the model did not answer a patch" in model.prompts[1]
    assert result["files_touched"] == ["hello.py"]


def test_files_are_quoted_in_the_validation_command(project):
    command = 'python -c "import sys; print(sys.argv[1:])" {files}'
    (project / "ioc.config.yml").write_text(f"validation:\n  command: '{command}'\n")
    result, model = run_loop(project, [make_patch(("my notes.txt", "create", "hello\n"))])

    assert result["succeeded"] is True
    assert "['my notes.txt']" in result["attempts"][0]["validation_output"]


def test_without_config_the_baseline_compiles_the_python_files(project):
    (project / "ioc.config.yml").unlink()
    patch = make_patch(("ok.py", "create", "x = 1\n"), ("notes.txt", "create", "hi\n"))
    result, model = run_loop(project, [patch])

    output = result["attempts"][0]["validation_output"]
    assert result["succeeded"] is True
    assert "ioc.config.yml not found" in output
    assert "$ python -m py_compile ok.py\n" in output
    assert leftovers(project) == []


def test_without_config_and_python_files_nothing_is_checked(project):
    (project / "ioc.config.yml").unlink()
    result, model = run_loop(project, [make_patch(("notes.txt", "create", "hi\n"))])

    assert result["succeeded"] is True
    assert "nothing to check" in result["attempts"][0]["validation_output"]


def test_a_broken_config_stops_before_asking_the_model(project):
    (project / "ioc.config.yml").write_text("validation: [\n")
    model = Model([make_patch(("hello.py", "create", "print(1)\n"))])

    with pytest.raises(patch_loop.ConfigError):
        loop("a request", 5, str(project), str(project), [], search_of(project), model.generate)
    assert model.prompts == []


def test_a_slow_validation_is_stopped(project, monkeypatch):
    monkeypatch.setattr(patch_loop, "TIMEOUT_SECONDS", 1)
    (project / "ioc.config.yml").write_text("validation:\n  command: sleep 5\n")
    before = tree_state(project)
    slow = make_patch(("hello.py", "create", "print(1)\n"))
    result, model = run_loop(project, [slow, slow, slow])

    assert "stopped after 1 s" in result["attempts"][0]["validation_output"]
    assert result["rolled_back"] is True
    assert tree_state(project) == before


def test_a_crash_in_the_middle_still_restores(project, monkeypatch):
    def crashing_validation(project_root, command, changed_files):
        raise RuntimeError("validation crashed")

    monkeypatch.setattr(patch_loop, "run_validation", crashing_validation)
    before = tree_state(project)
    patch = make_patch(("hello.py", "create", "print(1)\n"), ("main.py", "delete", ""))

    with pytest.raises(RuntimeError):
        run_loop(project, [patch])
    assert tree_state(project) == before


def test_another_target_path_is_refused(project, tmp_path):
    with pytest.raises(ValueError):
        run_loop(project, [], target_path=str(tmp_path))
