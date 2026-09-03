import { LayoutDashboard, SquareTerminal } from "lucide-react";
import type { WorkspaceView } from "@/shared/types/view";
import "./ViewSwitch.css";

export function ViewSwitch({
  value,
  onChange,
}: {
  value: WorkspaceView;
  onChange: (view: WorkspaceView) => void;
}) {
  return (
    <div className="view-switch" role="tablist" aria-label="Workspace view">
      <button
        type="button"
        role="tab"
        aria-selected={value === "editor"}
        className={"view-switch-opt" + (value === "editor" ? " active" : "")}
        onClick={() => onChange("editor")}
      >
        <SquareTerminal size={13} />
        <span>Editor</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "overview"}
        className={"view-switch-opt" + (value === "overview" ? " active" : "")}
        onClick={() => onChange("overview")}
      >
        <LayoutDashboard size={13} />
        <span>Overview</span>
      </button>
    </div>
  );
}
