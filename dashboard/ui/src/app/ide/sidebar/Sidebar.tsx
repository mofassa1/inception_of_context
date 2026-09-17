import { useState } from "react";
import { FilePlus, FolderPlus, FolderX } from "lucide-react";
import { FolderIcon } from "@/shared/components/FileIcons";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/shared/constants/config";
import { useResizable } from "@/shared/hooks/useResizable";
import { getBaseName } from "@/shared/lib/path";
import type { FileTreeCallbacks } from "@/shared/types/filesystem";
import { ContextMenu } from "./ContextMenu";
import { FileTree } from "./FileTree";
import { useContextMenu } from "./hooks/useContextMenu";

type SidebarProps = FileTreeCallbacks & {
  root: string;
  onCloseFolder: () => void;
  width: number;
  onResize: (width: number) => void;
  isIgnored: (entryPath: string) => boolean;
  onToggleIgnored: (entryPath: string) => void;
};

export function Sidebar({
  root,
  onCloseFolder,
  width,
  onResize,
  ...callbacks
}: SidebarProps) {
  const [creatingAtRoot, setCreatingAtRoot] = useState<"file" | "dir" | null>(null);

  const { position, openMenu, closeMenu } = useContextMenu();
  const { startResize } = useResizable({
    width,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    edge: "trailing",
    onResize,
  });

  return (
    <div className="group/sidebar relative flex min-h-0 shrink-0 flex-col overflow-y-auto border-r border-border bg-chrome-bg" style={{ width }}>
      <div className="sticky top-0 flex h-[35px] items-center gap-1.5 bg-chrome-bg px-3.5 text-[13px] font-semibold text-fg-strong" title={root} onContextMenu={openMenu}>
        <FolderIcon open />
        <span className="min-w-0 flex-1 truncate">{getBaseName(root)}</span>
        <div className="-mr-2 flex gap-0.5 opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            className="grid size-[22px] cursor-pointer place-items-center rounded border-none bg-transparent p-0 text-fg hover:bg-list-hover hover:text-fg-strong"
            title="New File"
            aria-label="New file in the root folder"
            onClick={() => setCreatingAtRoot("file")}
          >
            <FilePlus size={15} />
          </button>
          <button
            type="button"
            className="grid size-[22px] cursor-pointer place-items-center rounded border-none bg-transparent p-0 text-fg hover:bg-list-hover hover:text-fg-strong"
            title="New Folder"
            aria-label="New folder in the root folder"
            onClick={() => setCreatingAtRoot("dir")}
          >
            <FolderPlus size={15} />
          </button>
          <button
            type="button"
            className="grid size-[22px] cursor-pointer place-items-center rounded border-none bg-transparent p-0 text-fg hover:bg-list-hover hover:text-fg-strong"
            title="Close Folder"
            aria-label="Close folder and go back to the start screen"
            onClick={onCloseFolder}
          >
            <FolderX size={15} />
          </button>
        </div>
      </div>

      <FileTree
        root={root}
        creating={creatingAtRoot}
        onCreatingChange={setCreatingAtRoot}
        {...callbacks}
      />

      {position && (
        <ContextMenu
          x={position.x}
          y={position.y}
          onClose={closeMenu}
          items={[
            { label: "New File", onClick: () => setCreatingAtRoot("file") },
            { label: "New Folder", onClick: () => setCreatingAtRoot("dir") },
            { label: "Close Folder", onClick: onCloseFolder },
          ]}
        />
      )}

      <div
        className="absolute top-0 -right-0.5 z-5 h-full w-[5px] cursor-col-resize after:absolute after:top-0 after:left-0.5 after:h-full after:w-px after:bg-transparent after:transition-colors after:duration-120 hover:after:bg-accent"
        onMouseDown={startResize}
      />
    </div>
  );
}
