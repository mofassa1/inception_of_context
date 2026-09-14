import { Blocks } from "lucide-react";
import type { EditorTab, FileSaveStatus } from "@/shared/types/editor";

const SAVE_STATUS_COLORS: Record<FileSaveStatus, string> = {
  saved: "text-ok",
  saving: "text-info",
  error: "text-danger",
};

export function StatusBar({
  tab,
  chunkCount,
  showChunks,
  onToggleChunks,
}: {
  tab: EditorTab | null;
  chunkCount: number;
  showChunks: boolean;
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
    <div className="flex h-[22px] shrink-0 items-center gap-3 border-t border-border bg-chrome-bg px-3 font-ui text-[12px] text-fg-status">
      {tab && (
        <>
          <span className={"font-semibold " + SAVE_STATUS_COLORS[tab.status]}>{saveLabel}</span>
          <span className="truncate">{tab.path}</span>
        </>
      )}

      <span className="flex-1" />

      <button
        className={
          "inline-flex cursor-pointer items-center gap-[5px] rounded border bg-transparent px-[7px] py-px [font:inherit] text-[11px] hover:bg-list-hover " +
          (showChunks ? "border-info/35 text-info" : "border-transparent text-fg-dim hover:text-fg")
        }
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
