
import os
import sys
#response: CodePatch



import os
import shutil

from pydantic import BaseModel
from typing import Literal, cast


class PatchFile(BaseModel):
    path: str
    op: Literal["create", "modify", "delete", "noop"]
    content: str = ""


class CodePatch(BaseModel):
    summary: str
    files: list[PatchFile]

def create_backup(response: CodePatch, backup_dir: str) -> str:
    """Create a backup directory containing the current versions of affected files.

    Preserves the full absolute-path directory structure of each file under
    backup_dir, e.g. /home/user/proj/tests/foo.py -> backup_dir/home/user/proj/tests/foo.py
    """

    os.makedirs(backup_dir, exist_ok=True)

    for file in response.files:
        if file.op not in ("modify", "delete"):
            continue

        if not os.path.isfile(file.path):
            continue

        # file.path is absolute; os.path.join(backup_dir, file.path) would
        # silently discard backup_dir entirely because its second argument
        # is absolute. lstrip(os.sep) makes it relative first so the full
        # directory structure nests correctly under backup_dir instead.
        backup_path = os.path.join(backup_dir + "/" + file.path.split(os.sep)[-2].lstrip(os.sep),  file.path.split(os.sep)[-1].lstrip(os.sep) )

        os.makedirs(os.path.dirname(backup_path), exist_ok=True)

        shutil.copy2(file.path, backup_path)

    return backup_dir

if __name__ == "__main__":
    # Example usage
    response = CodePatch(
        summary="Example patch",
        files=[
            PatchFile(path="/home/afadouac/Desktop/inception_of_context/tests/test_index.py", op="modify", content="print('Hello, World!')"),
            PatchFile(path="/home/afadouac/Desktop/inception_of_context/tests/new_file.py", op="create", content="print('New file')"),
        ]
    )
    backup_dir = "../.backup"
    create_backup(response, backup_dir)