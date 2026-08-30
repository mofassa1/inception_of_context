import type { TreeCallbacks } from "../../fileTree.js";
import { FolderIcon } from "../fileIcons.js";
import { FileTree } from "./FileTree.js";

export function Sidebar({ root, ...callbacks }: TreeCallbacks & { root: string }) {
  const name = root.split("/").pop() || root;

  return (
    <div className="sidebar">
      <div className="sidebar-head" title={root}>
        <FolderIcon open />
        <span className="sidebar-head-name">{name}</span>
      </div>
      <FileTree root={root} {...callbacks} />
    </div>
  );
}
