import { useEffect, useState } from "react";
import { Copy, Minus, Square, SquareTerminal, X } from "lucide-react";
import { ViewSwitch, type WorkspaceView } from "./ViewSwitch.js";

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
    const ide = window.ide;
    if (!ide) return;
    ide.isMaximized().then(setMaximized);
    return ide.onMaximizeChange(setMaximized);
  }, []);

  return (
    <div className="titlebar">
      <div
        className="titlebar-drag"
        title={title}
        onDoubleClick={() => window.ide?.toggleMaximize()}
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
          onClick={() => window.ide?.minimize()}
        >
          <Minus size={15} />
        </button>
        <button
          className="titlebar-btn"
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={() => window.ide?.toggleMaximize()}
        >
          {maximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button
          className="titlebar-btn close"
          aria-label="Close"
          onClick={() => window.ide?.close()}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
