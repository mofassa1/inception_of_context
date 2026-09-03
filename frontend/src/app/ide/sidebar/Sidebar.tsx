import { FolderIcon } from "@/shared/components/FileIcons";
import { getBaseName } from "@/shared/lib/path";
import type { FileTreeCallbacks } from "@/shared/types/filesystem";
import { FileTree } from "./FileTree";
import "./sidebar.css";

type SidebarProps = FileTreeCallbacks & { root: string };

export function Sidebar({ root, ...callbacks }: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-head" title={root}>
        <FolderIcon open />
        <span className="sidebar-head-name">{getBaseName(root)}</span>
      </div>
      <FileTree root={root} {...callbacks} />
    </div>
  );
}
