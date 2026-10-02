import { FileDiff, Undo2 } from "lucide-react";
import { getRelativePath, joinPath } from "@/shared/lib/path";
import type { PatchFileDTO, PatchLoopOutputDTO } from "@/shared/types/dto";

const OP_LABEL: Record<PatchFileDTO["op"], string> = {
  create: "new",
  modify: "edit",
  delete: "delete",
};

const OP_COLORS: Record<PatchFileDTO["op"], string> = {
  create: "bg-ok/16 text-ok",
  modify: "bg-info/16 text-info",
  delete: "bg-danger/16 text-danger",
};

export function AgentResultCard({
  patchLoopOutput,
  root,
  onOpenFile,
}: {
  patchLoopOutput: PatchLoopOutputDTO;
  root: string;
  onOpenFile: (filePath: string) => void;
}) {
  const lastAttempt = patchLoopOutput.attempts[patchLoopOutput.attempts.length - 1];
  const attemptCount = `${patchLoopOutput.attempts.length} attempt${patchLoopOutput.attempts.length === 1 ? "" : "s"}`;

  if (!patchLoopOutput.succeeded) {
    return (
      <div role="group" aria-label="Agent result" className="mt-2 overflow-hidden rounded-md border border-border bg-input-bg">
        <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5 text-[11px] text-fg-dim">
          <Undo2 size={12} />
          <span>
            {patchLoopOutput.rolled_back ? "Rolled back, nothing changed" : "No files changed"} · {attemptCount}
          </span>
        </div>
        {lastAttempt?.sanity.code ? (
          <div className="px-2.5 py-1.5 text-[11px] text-danger">{lastAttempt.sanity.message}</div>
        ) : null}
      </div>
    );
  }

  const files = lastAttempt?.files ?? [];

  return (
    <div role="group" aria-label="Agent result" className="mt-2 overflow-hidden rounded-md border border-border bg-input-bg">
      <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5 text-[11px] text-fg-dim">
        <FileDiff size={12} />
        <span>
          {files.length} file{files.length === 1 ? "" : "s"} changed · {attemptCount}
        </span>
      </div>

      <div className="flex flex-col">
        {files.map((file) => (
          <button
            key={file.path}
            className="flex cursor-pointer items-center gap-2 border-none bg-transparent px-2.5 py-[5px] text-left [font:inherit] text-[12px] text-fg hover:bg-list-hover"
            title={file.path}
            onClick={() => onOpenFile(joinPath(root, file.path))}
          >
            <span
              className={
                "min-w-[42px] flex-none rounded-[3px] px-[5px] py-px text-center text-[10px] uppercase " +
                OP_COLORS[file.op]
              }
            >
              {OP_LABEL[file.op]}
            </span>
            <span className="truncate">{getRelativePath(file.path, root)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
