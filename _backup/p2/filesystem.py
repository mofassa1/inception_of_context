import shutil
from pathlib import Path

from p1.core.errors import (
    InvalidPath,
    NotTextFile,
    PathAlreadyExists,
    PathNotFound,
    missing_path,
)
from p2.filesystem_models import DirectoryEntry


class FileSystemService:
    def __init__(self, ignored_names: set[str], visible_roots: list[str]):
        self.ignored_names = ignored_names
        self.visible_roots = visible_roots

    @staticmethod
    def resolve(raw: str) -> Path:
        if not raw:
            raise InvalidPath("path is required")
        return Path(raw).expanduser().resolve()

    def list_directory(self, raw_path: str) -> tuple[Path, list[DirectoryEntry]]:
        target = self.resolve(raw_path)

        if not target.is_dir():
            raise missing_path(target, "directory", self.visible_roots)

        entries = [
            DirectoryEntry(name=child.name, path=child, is_dir=child.is_dir())
            for child in target.iterdir()
            if child.name not in self.ignored_names
        ]
        entries.sort(key=lambda entry: entry.sort_key)

        return target, entries

    def read_file(self, raw_path: str) -> tuple[Path, str]:
        target = self.resolve(raw_path)

        if not target.is_file():
            raise missing_path(target, "file", self.visible_roots)

        try:
            return target, target.read_text(encoding="utf-8")
        except UnicodeDecodeError as error:
            raise NotTextFile(
                "binary file, cannot display as text", path=str(target)
            ) from error

    def write_file(self, raw_path: str, content: str) -> Path:
        target = self.resolve(raw_path)

        if not target.is_file():
            raise missing_path(target, "file", self.visible_roots)

        target.write_text(content, encoding="utf-8")
        return target

    def create_entry(self, raw_path: str, is_dir: bool) -> Path:
        target = self.resolve(raw_path)

        if target.exists():
            raise PathAlreadyExists(f"already exists: {target}", path=str(target))
        if not target.parent.is_dir():
            raise PathNotFound(
                f"parent directory does not exist: {target.parent}",
                path=str(target.parent),
            )

        if is_dir:
            target.mkdir()
        else:
            target.touch()

        return target

    def delete_entry(self, raw_path: str) -> Path:
        target = self.resolve(raw_path)

        if not target.exists():
            raise PathNotFound(f"not found: {target}", path=str(target))

        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()

        return target

    def rename_entry(self, raw_path: str, raw_new_path: str) -> Path:
        source = self.resolve(raw_path)
        destination = self.resolve(raw_new_path)

        if not source.exists():
            raise PathNotFound(f"not found: {source}", path=str(source))
        if destination.exists():
            raise PathAlreadyExists(
                f"already exists: {destination}", path=str(destination)
            )

        source.rename(destination)
        return destination
