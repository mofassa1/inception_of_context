import type { EditorTab } from "@/shared/types/editor";

export function StatusBar({ tab }: { tab: EditorTab | null }) {
  if (!tab) return <div className="statusline" />;

  const label =
    tab.status === "saving"
      ? "saving…"
      : tab.status === "error"
        ? "error: " + tab.error
        : "saved";

  return (
    <div className="statusline">
      <span className={"status-word status-" + tab.status}>{label}</span>
      <span className="status-path">{tab.path}</span>
    </div>
  );
}
