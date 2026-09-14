from p3.validation import DEFAULT_COMMAND, expand_command, load_config, run


def test_files_placeholder_becomes_the_modified_files():
    assert expand_command("python -m py_compile {files}", ["/p/a.py", "/p/b.py"]) == [
        "python", "-m", "py_compile", "/p/a.py", "/p/b.py",
    ]


def test_without_ioc_config_the_subject_baseline_is_used(tmp_path):
    assert load_config(str(tmp_path)).command == DEFAULT_COMMAND == "python -m py_compile {files}"


def test_the_baseline_fails_on_a_broken_modified_file(tmp_path):
    broken = tmp_path / "broken.py"
    broken.write_text("def oops(:\n", encoding="utf-8")

    outcome = run(load_config(str(tmp_path)), str(tmp_path), [str(broken)])

    assert not outcome.passed
    assert "SyntaxError" in outcome.output


def test_the_baseline_passes_on_a_valid_modified_file(tmp_path):
    fine = tmp_path / "fine.py"
    fine.write_text("def ok():\n    return 1\n", encoding="utf-8")

    assert run(load_config(str(tmp_path)), str(tmp_path), [str(fine)]).passed
