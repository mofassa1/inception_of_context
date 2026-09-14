from p1.core.config import Settings
from p1.ignore import IgnoreRules
from p1.pipeline import walk_source_files


def build_tree(root):
    (root / "src").mkdir()
    (root / "src" / "app.py").write_text("x = 1\n", encoding="utf-8")

    for skipped in ("node_modules", "__pycache__", ".venv", "dist", "build"):
        (root / skipped).mkdir()
        (root / skipped / "junk.py").write_text("y = 2\n", encoding="utf-8")

    (root / ".hidden").mkdir()
    (root / ".hidden" / "secret.py").write_text("z = 3\n", encoding="utf-8")
    (root / ".dotfile").write_text("nope\n", encoding="utf-8")

    binary = root / "logo.png"
    binary.write_bytes(b"\x89PNG\x00\x00\x00\x00")

    return root


def walked(root):
    rules = IgnoreRules.build(None, None)
    return {str(path) for path in walk_source_files(str(root), rules)}


def test_indexes_source_and_skips_the_standard_directories(tmp_path):
    root = build_tree(tmp_path)
    found = walked(root)

    assert str(root / "src" / "app.py") in found
    for skipped in ("node_modules", "__pycache__", ".venv", "dist", "build"):
        assert not any(skipped in path for path in found)


def test_skips_hidden_directories_and_files(tmp_path):
    root = build_tree(tmp_path)
    found = walked(root)

    assert str(root / ".hidden" / "secret.py") not in found
    assert str(root / ".dotfile") not in found


def test_skips_binaries(tmp_path):
    root = build_tree(tmp_path)

    assert str(root / "logo.png") not in walked(root)


def test_never_walks_the_vector_store(tmp_path):
    """The subject requires the vector store is never indexed or watched."""
    settings = Settings()
    rules = IgnoreRules.build(None, None)

    assert rules.ignores_path(settings.chroma_path)
    assert rules.ignores_path(settings.data_dir)
    assert rules.ignores_path(settings.chroma_path + "/chroma.sqlite3")


def test_a_project_under_a_dot_directory_still_indexes(tmp_path):
    """Hidden segments are judged below the root, not in the absolute path."""
    root = tmp_path / ".config" / "project"
    (root / "src").mkdir(parents=True)
    source = root / "src" / "app.py"
    source.write_text("x = 1\n", encoding="utf-8")

    assert str(source) in walked(root)
