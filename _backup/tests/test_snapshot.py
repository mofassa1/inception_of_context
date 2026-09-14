import os

from p3.snapshot import ProjectSnapshot


def read(path):
    return path.read_text(encoding="utf-8")


def test_restores_a_modified_file_byte_for_byte(tmp_path):
    target = tmp_path / "service.py"
    original = "def keep():\n    return 1\n"
    target.write_text(original, encoding="utf-8")

    snapshot = ProjectSnapshot(str(tmp_path / "backup"))
    snapshot.capture(str(target))
    target.write_text("wrecked", encoding="utf-8")

    snapshot.restore()

    assert read(target) == original


def test_deletes_a_file_that_did_not_exist_before(tmp_path):
    created = tmp_path / "new.py"

    snapshot = ProjectSnapshot(str(tmp_path / "backup"))
    snapshot.capture(str(created))
    created.write_text("print('hi')\n", encoding="utf-8")

    snapshot.restore()

    assert not created.exists()


def test_restores_a_file_the_patch_deleted(tmp_path):
    target = tmp_path / "gone.py"
    original = "VALUE = 3\n"
    target.write_text(original, encoding="utf-8")

    snapshot = ProjectSnapshot(str(tmp_path / "backup"))
    snapshot.capture(str(target))
    target.unlink()

    snapshot.restore()

    assert read(target) == original


def test_keeps_the_pre_loop_state_across_repeated_captures(tmp_path):
    """Attempt 2 must not overwrite the baseline recorded before attempt 1."""
    target = tmp_path / "service.py"
    original = "ORIGINAL = 1\n"
    target.write_text(original, encoding="utf-8")

    snapshot = ProjectSnapshot(str(tmp_path / "backup"))

    snapshot.capture(str(target))
    target.write_text("ATTEMPT_ONE = 1\n", encoding="utf-8")

    snapshot.capture(str(target))
    target.write_text("ATTEMPT_TWO = 1\n", encoding="utf-8")

    snapshot.restore()

    assert read(target) == original


def test_restores_a_mixed_patch_completely(tmp_path):
    modified = tmp_path / "modified.py"
    deleted = tmp_path / "deleted.py"
    created = tmp_path / "created.py"

    modified.write_text("A = 1\n", encoding="utf-8")
    deleted.write_text("B = 2\n", encoding="utf-8")

    snapshot = ProjectSnapshot(str(tmp_path / "backup"))
    snapshot.capture_all([str(modified), str(deleted), str(created)])

    modified.write_text("A = 999\n", encoding="utf-8")
    deleted.unlink()
    created.write_text("C = 3\n", encoding="utf-8")

    snapshot.restore()

    assert read(modified) == "A = 1\n"
    assert read(deleted) == "B = 2\n"
    assert not created.exists()


def test_preserves_the_file_mode(tmp_path):
    target = tmp_path / "runnable.py"
    target.write_text("#!/usr/bin/env python\n", encoding="utf-8")
    os.chmod(target, 0o755)

    snapshot = ProjectSnapshot(str(tmp_path / "backup"))
    snapshot.capture(str(target))
    target.write_text("broken\n", encoding="utf-8")
    os.chmod(target, 0o600)

    snapshot.restore()

    assert os.stat(target).st_mode & 0o777 == 0o755
