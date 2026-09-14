import os
import tempfile

from fastapi import APIRouter

from p1.ignore import IgnoreRules
from p2.deps import (
    ConversationStoreDep,
    EventBusDep,
    IndexingServiceDep,
    PatchLoopDep,
    PatchingServiceDep,
    RuntimeInfoDep,
)
from p3.schemas import (
    ApplyPatchRequestDTO,
    ApplyPatchResponseDTO,
    PatchAttemptDTO,
    PatchFileDTO,
    PatchLoopRequestDTO,
    PatchLoopResponseDTO,
    PatchProposalResponseDTO,
    ProposePatchRequestDTO,
    SanityResultDTO,
)

router = APIRouter(prefix="/patch", tags=["patch"])


@router.post("/propose", response_model=PatchProposalResponseDTO)
def propose_patch(
    request: ProposePatchRequestDTO,
    patching: PatchingServiceDep,
    runtime: RuntimeInfoDep,
    conversations: ConversationStoreDep,
) -> PatchProposalResponseDTO:
    return PatchProposalResponseDTO(
        **patching.propose(
            request.query,
            request.k,
            target_root=runtime.target_project,
            history=conversations.history(request.conversationId),
        )
    )


@router.post("/apply", response_model=ApplyPatchResponseDTO)
def apply_patch(
    request: ApplyPatchRequestDTO,
    patching: PatchingServiceDep,
    indexing: IndexingServiceDep,
    event_bus: EventBusDep,
) -> ApplyPatchResponseDTO:
    files = [entry.model_dump() for entry in request.files]
    backup_dir = tempfile.mkdtemp(prefix="ioc-backup-")

    written = patching.apply(files, backup_dir)

    rules = IgnoreRules.build(request.ignoreNames, request.ignorePaths)

    reindexed = 0
    for entry in files:
        if entry["op"] != "delete" and os.path.isfile(entry["path"]):
            indexing.index_path(entry["path"], rules)
            reindexed += 1

    for path in written:
        event_bus.publish("patched", path, 0)

    return ApplyPatchResponseDTO(
        applied=written, reindexed=reindexed, backupDir=backup_dir
    )


@router.post("/loop", response_model=PatchLoopResponseDTO)
def run_patch_loop(
    request: PatchLoopRequestDTO,
    loop: PatchLoopDep,
    indexing: IndexingServiceDep,
    runtime: RuntimeInfoDep,
    event_bus: EventBusDep,
) -> PatchLoopResponseDTO:
    target_root = request.targetPath or runtime.target_project

    result = loop.run(
        query=request.query,
        target_root=target_root,
        k=request.k,
    )

    rules = IgnoreRules.build(None, None)
    event_name = "patched" if result.succeeded else "rolled_back"

    for path in result.files_touched:
        if os.path.isfile(path):
            indexing.index_path(path, rules)
        event_bus.publish(event_name, path, 0)

    return PatchLoopResponseDTO(
        succeeded=result.succeeded,
        rolledBack=result.rolled_back,
        filesTouched=result.files_touched,
        summary=result.summary,
        attempts=[
            PatchAttemptDTO(
                number=attempt.number,
                summary=attempt.summary,
                files=[PatchFileDTO(**entry) for entry in attempt.files],
                sanity=SanityResultDTO(
                    code=attempt.sanity_code, message=attempt.sanity_message
                ),
                applied=attempt.applied,
                validationPassed=attempt.validation_passed,
                validationOutput=attempt.validation_output,
            )
            for attempt in result.attempts
        ],
    )
