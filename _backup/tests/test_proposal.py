from p3.models import PatchFile
from p3.patching import NO_CHANGE_SUMMARY, build_prompt, describe_patch, resolve_patch_path


def test_an_operation_name_is_replaced_by_what_the_patch_does(tmp_path):
    files = [PatchFile(path=str(tmp_path / "hello.py"), op="create", content="print('hi')")]

    assert describe_patch("create", files, str(tmp_path)) == "Create hello.py."


def test_a_real_summary_is_kept(tmp_path):
    files = [PatchFile(path=str(tmp_path / "hello.py"), op="create", content="print('hi')")]

    assert describe_patch("Add hello.py that prints hi", files, str(tmp_path)) == (
        "Add hello.py that prints hi"
    )


def test_a_bare_noop_explains_what_to_ask_for(tmp_path):
    assert describe_patch("noop", [], str(tmp_path)) == NO_CHANGE_SUMMARY


def test_a_path_starting_with_the_project_name_is_not_doubled(tmp_path):
    root = tmp_path / "demo"
    root.mkdir()

    resolved = resolve_patch_path("demo/hello.py", str(root), [])

    assert resolved == str(root / "hello.py")


def test_a_real_subfolder_with_the_project_name_is_kept(tmp_path):
    root = tmp_path / "demo"
    (root / "demo").mkdir(parents=True)
    (root / "demo" / "inner.py").write_text("x = 1\n", encoding="utf-8")

    resolved = resolve_patch_path("demo/inner.py", str(root), [])

    assert resolved == str(root / "demo" / "inner.py")


def test_the_prompt_carries_the_conversation_so_follow_ups_resolve():
    prompt = build_prompt(
        query="add it",
        file_paths=["/project/main.py"],
        context="",
        history=[("user", "add print hello in main.py"), ("assistant", "Modify main.py.")],
    )

    assert "CONVERSATION SO FAR (oldest first):" in prompt
    assert "USER: add print hello in main.py" in prompt
    assert prompt.index("CONVERSATION SO FAR (oldest first):") < prompt.index("USER REQUEST:")


def test_the_prompt_has_no_conversation_section_without_history():
    prompt = build_prompt(query="add a test", file_paths=[], context="")

    assert "CONVERSATION SO FAR (oldest first):" not in prompt
