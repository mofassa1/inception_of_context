import {
  Database,
  FileCode2,
  LayoutDashboard,
  Sparkles,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import type { WorkspaceView } from "@/shared/types/view";
import "./ViewSwitch.css";

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
    <div className="view-switch" role="tablist" aria-label="Workspace view">
      {VIEWS.map(({ value: view, label, Icon }) => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={value === view}
          className={"view-switch-opt" + (value === view ? " active" : "")}
          onClick={() => onChange(view)}
        >
          <Icon size={13} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
