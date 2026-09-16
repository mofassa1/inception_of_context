from p1.general_infos_object import g_infos
from p3_beta.patcher import Patcher, SANITY_CHECK_DESCRIPTIONS


def loop(query: str, k: int, target_path: str | None, ignored_paths: list[str]) -> dict:
    """Attempt to satisfy the query with a patch, up to 3 tries, validating each one."""
    project_root = g_infos.get_target_path()
    patcher = Patcher(project_root=project_root, ignored_paths=ignored_paths)

    attempts = []
    feedback = ""
    rolled_back = False

    for iteration in range(3):
        response = patcher.answer_user_query(query, attempt_message=feedback, k=k)
        sanity_code = patcher.sanity_checker(response)

        applied = False
        validation_passed = False
        validation_output = ""

        if sanity_code == 0:
            try:
                patcher.create_backup(response, backup_dir="backups")
                patcher.atomic_replacement(response)
                applied = True

                validation_passed, validation_output = patcher.launch_tests()
                if not validation_passed:
                    feedback = f"Tests failed: {validation_output}"
                    patcher.restore_backup()
                    rolled_back = True
            except Exception as e:
                feedback = f"Error applying changes: {e}"
                patcher.restore_backup()
                rolled_back = True
        else:
            feedback = SANITY_CHECK_DESCRIPTIONS[sanity_code]

        attempts.append(
            {
                "number": iteration + 1,
                "summary": response.summary,
                # "noop" isn't a valid op on the server's side, drop it from the reported files
                "files": [f.model_dump() for f in response.files if f.op != "noop"],
                "sanity": {"code": sanity_code, "message": SANITY_CHECK_DESCRIPTIONS[sanity_code]},
                "applied": applied,
                "validation_passed": validation_passed,
                "validation_output": validation_output,
            }
        )

        if applied and validation_passed:
            return {
                "succeeded": True,
                "attempts": attempts,
                "rolled_back": False,
                "files_touched": sorted({f.path for f in response.files if f.op != "noop"}),
                "summary": response.summary,
            }

    return {
        "succeeded": False,
        "attempts": attempts,
        "rolled_back": rolled_back,
        "files_touched": [],
        "summary": "patch loop failed after 3 attempts",
    }