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
import "./sidebar.css";

type SidebarProps = FileTreeCallbacks & {
  root: string;
  onCloseFolder: () => void;
  width: number;
  onResize: (width: number) => void;
  isIgnored: (entryPath: string, entryName: string) => boolean;
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
    <div className="sidebar" style={{ width }}>
      <div className="sidebar-head" title={root} onContextMenu={openMenu}>
        <FolderIcon open />
        <span className="sidebar-head-name">{getBaseName(root)}</span>
        <div className="sidebar-head-actions">
          <button
            type="button"
            className="sidebar-action"
            title="New File"
            aria-label="New file in the root folder"
            onClick={() => setCreatingAtRoot("file")}
          >
            <FilePlus size={15} />
          </button>
          <button
            type="button"
            className="sidebar-action"
            title="New Folder"
            aria-label="New folder in the root folder"
            onClick={() => setCreatingAtRoot("dir")}
          >
            <FolderPlus size={15} />
          </button>
          <button
            type="button"
            className="sidebar-action"
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

      <div className="sidebar-resize" onMouseDown={startResize} />
    </div>
  );
}
