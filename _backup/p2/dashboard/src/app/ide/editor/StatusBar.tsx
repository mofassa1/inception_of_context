import { Blocks } from "lucide-react";
import type { EditorTab } from "@/shared/types/editor";

export function StatusBar({
  tab,
  chunkCount,
  showChunks,
  indexing,
  onToggleChunks,
}: {
  tab: EditorTab | null;
  chunkCount: number;
  showChunks: boolean;
  indexing: boolean;
  onToggleChunks: () => void;
}) {
  const saveLabel =
    tab?.status === "saving"
      ? "saving…"
      : tab?.status === "error"
        ? "error: " + tab.error
        : tab
          ? "saved"
          : "";

  return (
    <div className="statusline">
      {tab && (
        <>
          <span className={"status-word status-" + tab.status}>{saveLabel}</span>
          <span className="status-path">{tab.path}</span>
        </>
      )}

      <span className="status-spacer" />

      {indexing && <span className="status-indexing">indexing…</span>}

      <button
        className={"status-chunks" + (showChunks ? " active" : "")}
        title={showChunks ? "Hide chunk overlay" : "Show chunk overlay"}
        aria-pressed={showChunks}
        onClick={onToggleChunks}
      >
        <Blocks size={12} />
        <span>
          {chunkCount} chunk{chunkCount === 1 ? "" : "s"}
        </span>
      </button>
    </div>
  );
}
