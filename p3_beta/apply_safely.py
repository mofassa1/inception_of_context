import os
import shutil

from pydantic import BaseModel
from typing import Literal


class PatchFile(BaseModel):
    path: str
    op: Literal["create", "modify", "delete", "noop"]
    content: str = ""


class CodePatch(BaseModel):
    summary: str
    files: list[PatchFile]


def create_backup(response: CodePatch, backup_dir: str) -> str:
    os.makedirs(backup_dir, exist_ok=True)

    for file in response.files:
        if file.op not in ("modify", "delete"):
            continue

        if not os.path.isfile(file.path):
            continue

        backup_path = os.path.join(backup_dir, file.path.lstrip(os.sep))

        os.makedirs(os.path.dirname(backup_path), exist_ok=True)

        shutil.copy2(file.path, backup_path)

    return backup_dir


def atomic_replacement(response: CodePatch) -> None:

    staged: list[tuple[str, str]] = [] 
    to_delete: list[str] = []

    try:
      
        for file in response.files:
            if file.op in ("create", "modify"):
                parent_dir = os.path.dirname(file.path)
                if parent_dir:
                    os.makedirs(parent_dir, exist_ok=True)

                tmp_path = file.path + ".ioc.tmp"
                with open(tmp_path, "w", encoding="utf-8") as f:
                    f.write(file.content)

                staged.append((tmp_path, file.path))

            elif file.op == "delete":
                to_delete.append(file.path)

            elif file.op == "noop":
                continue
        for tmp_path, final_path in staged:
            os.replace(tmp_path, final_path)

        for path in to_delete:
            if os.path.isfile(path):
                os.remove(path)

    except Exception:
        for tmp_path, _ in staged:
            if os.path.isfile(tmp_path):
                os.remove(tmp_path)
        raise


def restore_backup(backup_dir: str) -> None:
    pass


if __name__ == "__main__":
    response = CodePatch(
        summary="Example patch",
        files=[
            PatchFile(path="/tmp/atomic_test/tests/test_index.py", op="modify", content="print('Hello, World!')"),
            PatchFile(path="/tmp/atomic_test/new_dir/new_file.py", op="create", content="print('New file')"),
        ]
    )
    backup_dir = "/home/afadouac/Desktop/inception_of_context/testes___________backup"
    shutil.rmtree(backup_dir, ignore_errors=True)

    create_backup(response, backup_dir)
    atomic_replacement(response)

    with open("/tmp/atomic_test/tests/test_index.py") as f:
        print("modified file now contains:", f.read())
    with open("/tmp/atomic_test/new_dir/new_file.py") as f:
        print("created file now contains:", f.read())