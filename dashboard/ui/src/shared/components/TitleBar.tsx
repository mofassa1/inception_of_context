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
    <div className="relative flex h-8 shrink-0 items-stretch border-b border-border bg-chrome-bg select-none [-webkit-app-region:drag]">
      <div
        className="flex min-w-0 flex-1 items-center gap-2 px-3"
        title={title}
        onDoubleClick={toggleMaximizeWindow}
      >
        <SquareTerminal className="shrink-0 text-info opacity-85" size={15} />
        <span className="truncate text-[12px] text-fg-status">{label}</span>
      </div>

      {showSwitch && view && onViewChange && (
        <div className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center [-webkit-app-region:no-drag]">
          <ViewSwitch value={view} onChange={onViewChange} />
        </div>
      )}

      <div className="flex [-webkit-app-region:no-drag]">
        <button
          className="flex h-full w-[46px] cursor-pointer items-center justify-center border-0 bg-transparent text-fg hover:bg-white/8"
          aria-label="Minimize"
          onClick={minimizeWindow}
        >
          <Minus size={15} />
        </button>
        <button
          className="flex h-full w-[46px] cursor-pointer items-center justify-center border-0 bg-transparent text-fg hover:bg-white/8"
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={toggleMaximizeWindow}
        >
          {maximized ? <Copy size={13} /> : <Square size={13} />}
        </button>
        <button
          className="flex h-full w-[46px] cursor-pointer items-center justify-center border-0 bg-transparent text-fg hover:bg-window-close hover:text-white"
          aria-label="Close"
          onClick={closeWindow}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
