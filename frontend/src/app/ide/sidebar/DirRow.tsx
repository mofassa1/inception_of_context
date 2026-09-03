import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { FolderIcon } from "@/shared/components/FileIcons";
import {
  TREE_BASE_PADDING_PX,
  TREE_INDENT_PX,
} from "@/shared/constants/config";
import type {
  DirectoryEntry,
  FileTreeCallbacks,
} from "@/shared/types/filesystem";
import { ContextMenu } from "./ContextMenu";
import { FileRow } from "./FileRow";
import { NameInput } from "./NameInput";
import { useContextMenu } from "./hooks/useContextMenu";
import { useDirectory } from "./hooks/useDirectory";
import { useEntryActions } from "./hooks/useEntryActions";

type DirRowProps = FileTreeCallbacks & {
  entry: DirectoryEntry;
  depth: number;
};

export function DirRow({
  entry,
  depth,
  onOpenFile,
  onPathRemoved,
  onPathRenamed,
}: DirRowProps) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [creating, setCreating] = useState<"file" | "dir" | null>(null);

  const { position, openMenu, closeMenu } = useContextMenu();
  const { entries, error } = useDirectory(entry.path, open);
  const { renameTo, remove, createChild } = useEntryActions(entry, {
    onPathRemoved,
    onPathRenamed,
  });

  const callbacks = { onOpenFile, onPathRemoved, onPathRenamed };

  async function submitRename(nextName: string) {
    setRenaming(false);
    await renameTo(nextName);
  }

  async function deleteFolder() {
    closeMenu();
    await remove(`Delete "${entry.name}" and everything in it?`);
  }

  async function submitCreate(name: string, isDirectory: boolean) {
    setCreating(null);
    const created = await createChild(name, isDirectory);
    if (created) setOpen(true);
  }

  function startCreating(kind: "file" | "dir") {
    setOpen(true);
    setCreating(kind);
  }

  return (
    <div className="tree-node">
      <div
        className={"tree-row tree-dir" + (open ? " open" : "")}
        style={{ paddingLeft: TREE_BASE_PADDING_PX + depth * TREE_INDENT_PX }}
        onClick={() => setOpen((isOpen) => !isOpen)}
        onContextMenu={openMenu}
      >
        <ChevronRight className="tree-caret" size={14} strokeWidth={2.5} />
        <FolderIcon open={open} />
        {renaming ? (
          <NameInput
            initialValue={entry.name}
            onSubmit={submitRename}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span className="tree-name">{entry.name}</span>
        )}
      </div>

      {position && (
        <ContextMenu
          x={position.x}
          y={position.y}
          onClose={closeMenu}
          items={[
            { label: "New File", onClick: () => startCreating("file") },
            { label: "New Folder", onClick: () => startCreating("dir") },
            { label: "Rename", onClick: () => setRenaming(true) },
            { label: "Delete", onClick: deleteFolder, danger: true },
          ]}
        />
      )}

      {open && (
        <div className="tree-children">
          {error && <div className="tree-error">{error.message}</div>}
          {creating && (
            <div
              className="tree-row"
              style={{
                paddingLeft: TREE_BASE_PADDING_PX + (depth + 1) * TREE_INDENT_PX,
              }}
            >
              <NameInput
                placeholder={creating === "dir" ? "folder name" : "file name"}
                onSubmit={(name) => submitCreate(name, creating === "dir")}
                onCancel={() => setCreating(null)}
              />
            </div>
          )}
          {entries.map((child) =>
            child.is_dir ? (
              <DirRow
                key={child.path}
                entry={child}
                depth={depth + 1}
                {...callbacks}
              />
            ) : (
              <FileRow
                key={child.path}
                entry={child}
                depth={depth + 1}
                {...callbacks}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
