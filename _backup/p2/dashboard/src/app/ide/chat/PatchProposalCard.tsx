import { Check, FileDiff, X } from "lucide-react";
import { getRelativePath } from "@/shared/lib/path";
import type { PatchProposal } from "@/shared/types/agent";
import type { PatchStatus } from "@/shared/types/chat";

const OP_LABEL: Record<string, string> = {
  create: "new",
  modify: "edit",
  delete: "delete",
};

const NO_CHANGES_NEEDED = 1;

export function PatchProposalCard({
  proposal,
  status,
  root,
  applying,
  onOpenFile,
  onAcceptAll,
  onReject,
}: {
  proposal: PatchProposal;
  status?: PatchStatus;
  root: string;
  applying: boolean;
  onOpenFile: (filePath: string) => void;
  onAcceptAll: () => void;
  onReject: () => void;
}) {
  if (proposal.files.length === 0) {
    return (
      <div className="patch-note">
        {proposal.sanity.code === NO_CHANGES_NEEDED
          ? "No code changes needed."
          : proposal.sanity.message}
      </div>
    );
  }

  const blocked = proposal.sanity.code !== 0;

  return (
    <div className="patch-card">
      <div className="patch-card-head">
        <FileDiff size={12} />
        <span>
          {proposal.files.length} file{proposal.files.length === 1 ? "" : "s"} proposed
        </span>
      </div>

      {blocked && <div className="patch-warning">{proposal.sanity.message}</div>}

      <div className="patch-files">
        {proposal.files.map((file) => (
          <button
            key={file.path}
            className="patch-file"
            title={file.path}
            onClick={() => onOpenFile(file.path)}
          >
            <span className={"patch-op patch-op-" + file.op}>
              {OP_LABEL[file.op] ?? file.op}
            </span>
            <span className="patch-file-name">{getRelativePath(file.path, root)}</span>
          </button>
        ))}
      </div>

      {status === "applied" && (
        <div className="patch-status applied">
          <Check size={12} /> Applied
        </div>
      )}
      {status === "rejected" && (
        <div className="patch-status rejected">
          <X size={12} /> Rejected, nothing was written
        </div>
      )}

      {!status && (
      <div className="patch-actions">
        <button
          className="patch-accept"
          disabled={applying || blocked}
          title={blocked ? proposal.sanity.message : "Write these files to disk"}
          onClick={onAcceptAll}
        >
          <Check size={12} />
          <span>{applying ? "Applying…" : "Accept all"}</span>
        </button>
        <button className="patch-reject" disabled={applying} onClick={onReject}>
          <X size={12} />
          <span>Reject</span>
        </button>
      </div>
      )}
    </div>
  );
}
