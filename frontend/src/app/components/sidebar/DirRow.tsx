import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Entry } from "../../api.js";
import { FolderIcon } from "../fileIcons.js";
import {
  type TreeCallbacks,
  useCreateEntry,
  useDeleteEntry,
  useDirectory,
  useRenameEntry,
} from "../../fileTree.js";
import { ContextMenu } from "./ContextMenu.js";
import { FileRow } from "./FileRow.js";
import { NameInput } from "./NameInput.js";

type Props = TreeCallbacks & { entry: Entry; depth: number };

export function DirRow({ entry, depth, onOpenFile, onPathRemoved, onPathRenamed }: Props) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [creating, setCreating] = useState<"file" | "dir" | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const { data: entries, error } = useDirectory(entry.path, open);
  const createEntry = useCreateEntry();
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
    if (!confirm(`Delete "${entry.name}" and everything in it?`)) return;
    try {
      await deleteEntry.mutateAsync(entry.path);
      onPathRemoved(entry.path);
    } catch (err) {
      alert("Delete failed: " + (err as Error).message);
    }
  }

  async function doCreate(name: string, isDir: boolean) {
    setCreating(null);
    if (!name) return;
    try {
      await createEntry.mutateAsync({ path: entry.path + "/" + name, isDir });
      setOpen(true);
    } catch (err) {
      alert("Couldn't create: " + (err as Error).message);
    }
  }

  const callbacks = { onOpenFile, onPathRemoved, onPathRenamed };

  return (
    <div className="tree-node">
      <div
        className={"tree-row tree-dir" + (open ? " open" : "")}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => setOpen((o) => !o)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <ChevronRight className="tree-caret" size={14} strokeWidth={2.5} />
        <FolderIcon open={open} />
        {renaming ? (
          <NameInput initial={entry.name} onSubmit={doRename} onCancel={() => setRenaming(false)} />
        ) : (
          <span className="tree-name">{entry.name}</span>
        )}
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "New File",
              onClick: () => {
                setOpen(true);
                setCreating("file");
              },
            },
            {
              label: "New Folder",
              onClick: () => {
                setOpen(true);
                setCreating("dir");
              },
            },
            { label: "Rename", onClick: () => setRenaming(true) },
            { label: "Delete", onClick: doDelete, danger: true },
          ]}
        />
      )}
      {open && (
        <div className="tree-children">
          {error && <div className="tree-error">{(error as Error).message}</div>}
          {creating && (
            <div className="tree-row" style={{ paddingLeft: 8 + (depth + 1) * 14 }}>
              <NameInput
                placeholder={creating === "dir" ? "folder name" : "file name"}
                onSubmit={(name) => doCreate(name, creating === "dir")}
                onCancel={() => setCreating(null)}
              />
            </div>
          )}
          {entries?.map((e) =>
            e.is_dir ? (
              <DirRow key={e.path} entry={e} depth={depth + 1} {...callbacks} />
            ) : (
              <FileRow key={e.path} entry={e} depth={depth + 1} {...callbacks} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
