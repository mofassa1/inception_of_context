import pytest

from p3.models import CodePatch, PatchFile
from p3.patching import PatchingService


class FakeStore:
    def __init__(self, files: dict[str, str]):
        self.files = files

    def indexed_files(self) -> list[str]:
        return list(self.files)

    def get_file_chunks_with_content(self, file_path: str) -> dict[str, list]:
        return {"documents": [self.files.get(file_path, "")]}


@pytest.fixture
def existing(tmp_path):
    path = tmp_path / "service.py"
    path.write_text(
        "def alpha():\n    return 1\n\n\ndef beta():\n    return 2\n", encoding="utf-8"
    )
    return path


@pytest.fixture
def service(existing):
    store = FakeStore({str(existing): existing.read_text(encoding="utf-8")})
    return PatchingService(store=store, retrieval=None, llm=None)


def patch(*files: PatchFile) -> CodePatch:
    return CodePatch(summary="test", files=list(files))


def test_accepts_a_complete_modify(service, existing):
    content = existing.read_text(encoding="utf-8") + "\n\ndef gamma():\n    return 3\n"
    code = service.sanity_check(patch(PatchFile(path=str(existing), op="modify", content=content)))

    assert code == 0


def test_refuses_more_than_three_files(service, existing):
    files = [
        PatchFile(path=f"{existing}.{index}", op="create", content="x = 1\n")
        for index in range(4)
    ]

    assert service.sanity_check(patch(*files)) == 3


def test_refuses_creating_a_file_that_exists(service, existing):
    code = service.sanity_check(
        patch(PatchFile(path=str(existing), op="create", content="x = 1\n"))
    )

    assert code == 5


def test_refuses_a_stub_body(service, tmp_path):
    for body in ("    pass\n", "    ...\n", "    return None\n", "    return\n"):
        code = service.sanity_check(
            patch(
                PatchFile(
                    path=str(tmp_path / "new.py"),
                    op="create",
                    content=f"def thing():\n{body}",
                )
            )
        )
        assert code == 8, body


def test_refuses_shrinking_a_file_by_more_than_60_percent(service, existing):
    code = service.sanity_check(
        patch(PatchFile(path=str(existing), op="modify", content="x = 1\n"))
    )

    assert code == 9


def test_accepts_a_rename_even_though_the_old_name_disappears(service, existing):
    """The subject's own example intent is "rename foo to bar"."""
    renamed = existing.read_text(encoding="utf-8").replace("def alpha", "def first")
    code = service.sanity_check(patch(PatchFile(path=str(existing), op="modify", content=renamed)))

    assert code == 0


def test_refuses_creating_a_file_that_exists_on_disk_but_is_not_indexed(service, tmp_path):
    unindexed = tmp_path / "notes.txt"
    unindexed.write_text("keep me\n", encoding="utf-8")

    code = service.sanity_check(patch(PatchFile(path=str(unindexed), op="create", content="x\n")))

    assert code == 5


def test_refuses_leaked_retrieval_markers(service, tmp_path):
    leaked = (
        "─── notes/service.py · lines 1-4 · function alpha\n"
        "def alpha():\n    return 1\n"
    )
    code = service.sanity_check(
        patch(PatchFile(path=str(tmp_path / "new.py"), op="create", content=leaked))
    )

    assert code == 11


def test_refuses_replacing_a_file_with_a_placeholder(service, existing):
    for placeholder in ("None", "null", '""', "  none  "):
        code = service.sanity_check(
            patch(PatchFile(path=str(existing), op="modify", content=placeholder))
        )
        assert code == 12, placeholder


def test_accepts_creating_an_empty_file(service, tmp_path):
    """"create testfile.py" is a real request; an empty new file is its answer."""
    code = service.sanity_check(patch(PatchFile(path=str(tmp_path / "testfile.py"), op="create", content="")))

    assert code == 0


def test_refuses_a_modify_with_no_content(service, existing):
    code = service.sanity_check(patch(PatchFile(path=str(existing), op="modify", content="")))

    assert code != 0
