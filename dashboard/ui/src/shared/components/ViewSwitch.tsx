import {
  Database,
  FileCode2,
  LayoutDashboard,
  Sparkles,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import type { WorkspaceView } from "@/shared/types/view";

const VIEWS = [
  { value: "editor", label: "Editor", Icon: SquareTerminal },
  { value: "overview", label: "Overview", Icon: LayoutDashboard },
  { value: "files", label: "Files", Icon: FileCode2 },
  { value: "explorer", label: "ChromaDB", Icon: Database },
  { value: "ask", label: "Ask", Icon: Sparkles },
  { value: "patch", label: "Patch", Icon: Wrench },
] as const satisfies readonly {
  value: WorkspaceView;
  label: string;
  Icon: typeof SquareTerminal;
}[];

export function ViewSwitch({
  value,
  onChange,
}: {
  value: WorkspaceView;
  onChange: (view: WorkspaceView) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-border bg-input-bg p-0.5" role="tablist" aria-label="Workspace view">
      {VIEWS.map(({ value: view, label, Icon }) => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={value === view}
          className={
            "inline-flex h-[22px] cursor-pointer items-center gap-1.5 rounded-md border-0 px-2.5 font-ui text-[11.5px] font-medium transition-[color,background-color] duration-120 " +
            (value === view ? "bg-accent text-white" : "bg-transparent text-fg-dim hover:text-fg")
          }
          onClick={() => onChange(view)}
        >
          <Icon size={13} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
