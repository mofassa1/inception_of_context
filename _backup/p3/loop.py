import tempfile
from dataclasses import dataclass, field

from p1.core.logging import get_logger
from p3 import validation
from p3.patching import SANITY_MESSAGES, PatchingService, apply_files
from p3.snapshot import ProjectSnapshot

logger = get_logger(__name__)

MAX_ATTEMPTS = 3


@dataclass
class Attempt:
    number: int
    summary: str
    files: list[dict]
    sanity_code: int
    sanity_message: str
    applied: bool = False
    validation_passed: bool = False
    validation_output: str = ""


@dataclass
class LoopResult:
    succeeded: bool
    attempts: list[Attempt] = field(default_factory=list)
    rolled_back: bool = False
    files_touched: list[str] = field(default_factory=list)
    summary: str = ""


class PatchLoop:
    """propose → sanity → apply → validate, up to three times, then roll back.

    Every file an attempt is about to touch is snapshotted *before* it is
    written, and the snapshot keeps the first state it saw for each path. So
    however many attempts run and whatever they touch, a rollback restores the
    state from before attempt 1 — which is what the subject requires.
    """

    def __init__(self, patching: PatchingService, max_attempts: int = MAX_ATTEMPTS):
        self.patching = patching
        self.max_attempts = max_attempts

    def run(
        self,
        query: str,
        target_root: str,
        k: int = 5,
    ) -> LoopResult:
        config = validation.load_config(target_root)
        snapshot = ProjectSnapshot(tempfile.mkdtemp(prefix="ioc-loop-"))
        result = LoopResult(succeeded=False)
        feedback = ""

        logger.info(
            "patch loop starting on %s, validating with %r (%s)",
            target_root,
            config.command,
            config.source,
        )

        for number in range(1, self.max_attempts + 1):
            proposal = self.patching.propose(
                query, k, feedback=feedback, target_root=target_root
            )
            attempt = Attempt(
                number=number,
                summary=proposal["summary"],
                files=proposal["files"],
                sanity_code=proposal["sanity"]["code"],
                sanity_message=proposal["sanity"]["message"],
            )
            result.attempts.append(attempt)

            if attempt.sanity_code != 0:
                logger.info("attempt %d rejected by sanity: %s", number, attempt.sanity_message)
                feedback = self.feedback_for_sanity(attempt.sanity_code)
                continue

            snapshot.capture_all([entry["path"] for entry in attempt.files])

            try:
                apply_files(attempt.files, self.patching.store)
                attempt.applied = True
            except OSError as error:
                logger.warning("attempt %d could not be written: %s", number, error)
                feedback = f"Applying the change failed: {error}. Propose a different change."
                continue

            outcome = validation.run(
                config,
                target_root,
                [entry["path"] for entry in attempt.files if entry["op"] != "delete"],
            )
            attempt.validation_passed = outcome.passed
            attempt.validation_output = outcome.output

            if outcome.passed:
                logger.info("attempt %d passed validation", number)
                result.succeeded = True
                result.summary = attempt.summary
                result.files_touched = [entry["path"] for entry in attempt.files]
                snapshot.discard()
                return result

            logger.info("attempt %d failed validation", number)
            feedback = self.feedback_for_validation(outcome.command, outcome.output)

        result.rolled_back = True
        result.files_touched = snapshot.restore()
        result.summary = (
            f"Gave up after {len(result.attempts)} attempts without passing "
            f"`{config.command}`. The project was restored to its previous state."
        )
        snapshot.discard()
        return result

    def feedback_for_sanity(self, code: int) -> str:
        return (
            f"Your previous answer was rejected: {SANITY_MESSAGES[code]} "
            "Fix that and return the complete content of every file you change."
        )

    def feedback_for_validation(self, command: str, output: str) -> str:
        return (
            f"Your previous change was applied but `{command}` failed:\n\n{output}\n\n"
            "Fix the cause and return the complete content of every file you change."
        )
