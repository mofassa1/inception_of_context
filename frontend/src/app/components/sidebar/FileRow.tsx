import { useState } from "react";
import type { Entry } from "../../api.js";
import { type TreeCallbacks, useDeleteEntry, useRenameEntry } from "../../fileTree.js";
import { ContextMenu } from "./ContextMenu.js";
import { FileIcon } from "../fileIcons.js";
import { NameInput } from "./NameInput.js";

type Props = TreeCallbacks & { entry: Entry; depth: number };

export function FileRow({ entry, depth, onOpenFile, onPathRemoved, onPathRenamed }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const deleteEntry = useDeleteEntry();
  const renameEntry = useRenameEntry();

  async function doRename(newName: string) {
    setRenaming(false);
    if (!newName || newName === entry.name) return;
    const parent = entry.path.slice(0, entry.path.length - entry.name.length);
    const newPath = parent + newName;
    try {
      await renameEntry.mutateAsync({ path: entry.path, newPath });
      onPathRenamed(entry.path, newPath);
    } catch (err) {
      alert("Rename failed: " + (err as Error).message);
    }
  }

  async function doDelete() {
    setMenu(null);
    if (!confirm(`Delete "${entry.name}"?`)) return;
    try {
      await deleteEntry.mutateAsync(entry.path);
      onPathRemoved(entry.path);
    } catch (err) {
      alert("Delete failed: " + (err as Error).message);
    }
  }

  return (
    <div
      className="tree-row tree-file"
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => !renaming && onOpenFile(entry.path)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <span className="tree-indent" />
      <FileIcon name={entry.name} />
      {renaming ? (
        <NameInput initial={entry.name} onSubmit={doRename} onCancel={() => setRenaming(false)} />
      ) : (
        <span className="tree-name">{entry.name}</span>
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "Rename", onClick: () => setRenaming(true) },
            { label: "Delete", onClick: doDelete, danger: true },
          ]}
        />
      )}
    </div>
  );
}
