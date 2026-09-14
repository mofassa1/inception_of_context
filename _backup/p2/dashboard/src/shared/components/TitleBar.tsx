import { useEffect, useState } from "react";
import { Copy, Minus, Square, SquareTerminal, X } from "lucide-react";
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  onMaximizeChange,
  toggleMaximizeWindow,
} from "@/shared/api/desktopBridge";
import type { WorkspaceView } from "@/shared/types/view";
import { ViewSwitch } from "./ViewSwitch";
import "./TitleBar.css";

export function TitleBar({
  label,
  title,
  view,
  onViewChange,
  showSwitch = false,
}: {
  label: string;
  title?: string;
  view?: WorkspaceView;
  onViewChange?: (view: WorkspaceView) => void;
  showSwitch?: boolean;
}) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    isWindowMaximized().then(setMaximized);
    return onMaximizeChange(setMaximized);
  }, []);

  return (
    <div className="titlebar">
      <div
        className="titlebar-drag"
        title={title}
        onDoubleClick={toggleMaximizeWindow}
      >
        <SquareTerminal className="titlebar-mark" size={15} />
        <span className="titlebar-label">{label}</span>
      </div>

      {showSwitch && view && onViewChange && (
        <div className="titlebar-center">
          <ViewSwitch value={view} onChange={onViewChange} />
        </div>
      )}

      <div className="titlebar-buttons">
        <button
          className="titlebar-btn"
          aria-label="Minimize"
          onClick={minimizeWindow}
        >
          <Minus size={15} />
        </button>
        <button
          className="titlebar-btn"
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={toggleMaximizeWindow}
        >
          {maximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button
          className="titlebar-btn close"
          aria-label="Close"
          onClick={closeWindow}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
