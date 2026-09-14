import os
import shutil
from pathlib import Path

from p1.core.logging import get_logger

logger = get_logger(__name__)


class ProjectSnapshot:
    """Records the exact on-disk state of every file the loop is about to touch.

    The subject is explicit that a partial rollback does not pass: after a failed
    loop the project must be byte-identical to what it was before the first
    attempt. Two cases are easy to get wrong and are handled here —

    - a file the model *created* has no previous content, so rolling it back
      means deleting it, not restoring an empty file;
    - a file the model *deleted* has to come back with its original mode.

    `capture` is idempotent per path and only ever records the first state it
    sees, so calling it again on attempt 2 or 3 cannot overwrite the pre-loop
    baseline with an already-patched version.
    """

    def __init__(self, backup_dir: str):
        self.backup_dir = backup_dir
        self._absent: set[str] = set()
        self._saved: dict[str, str] = {}
        self._modes: dict[str, int] = {}

        os.makedirs(self.backup_dir, exist_ok=True)

    @property
    def tracked_paths(self) -> list[str]:
        return sorted(self._absent | set(self._saved))

    def capture(self, file_path: str) -> None:
        resolved = str(Path(file_path).expanduser().resolve())

        if resolved in self._absent or resolved in self._saved:
            return

        if not os.path.isfile(resolved):
            self._absent.add(resolved)
            logger.debug("snapshot: %s did not exist", resolved)
            return

        destination = os.path.join(self.backup_dir, resolved.lstrip(os.sep))
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        shutil.copy2(resolved, destination)

        self._saved[resolved] = destination
        self._modes[resolved] = os.stat(resolved).st_mode
        logger.debug("snapshot: saved %s", resolved)

    def capture_all(self, file_paths: list[str]) -> None:
        for file_path in file_paths:
            self.capture(file_path)

    def restore(self) -> list[str]:
        """Put every tracked path back to its pre-loop state. Returns what changed."""
        restored: list[str] = []

        for resolved, backup in self._saved.items():
            os.makedirs(os.path.dirname(resolved), exist_ok=True)
            shutil.copy2(backup, resolved)
            os.chmod(resolved, self._modes[resolved])
            restored.append(resolved)

        for resolved in self._absent:
            if os.path.isfile(resolved):
                os.remove(resolved)
                restored.append(resolved)

        logger.info("rolled back %d path(s)", len(restored))
        return sorted(restored)

    def discard(self) -> None:
        shutil.rmtree(self.backup_dir, ignore_errors=True)
