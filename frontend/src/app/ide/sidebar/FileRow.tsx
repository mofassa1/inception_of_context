import { useState } from "react";
import { FileIcon } from "@/shared/components/FileIcons";
import {
  TREE_BASE_PADDING_PX,
  TREE_INDENT_PX,
} from "@/shared/constants/config";
import type {
  DirectoryEntry,
  FileTreeCallbacks,
} from "@/shared/types/filesystem";
import { ContextMenu } from "./ContextMenu";
import { NameInput } from "./NameInput";
import { useContextMenu } from "./hooks/useContextMenu";
import { useEntryActions } from "./hooks/useEntryActions";

type FileRowProps = FileTreeCallbacks & {
  entry: DirectoryEntry;
  depth: number;
};

export function FileRow({
  entry,
  depth,
  onOpenFile,
  onPathRemoved,
  onPathRenamed,
}: FileRowProps) {
  const [renaming, setRenaming] = useState(false);
  const { position, openMenu, closeMenu } = useContextMenu();
  const { renameTo, remove } = useEntryActions(entry, {
    onPathRemoved,
    onPathRenamed,
  });

  async function submitRename(nextName: string) {
    setRenaming(false);
    await renameTo(nextName);
  }

  async function deleteFile() {
    closeMenu();
    await remove(`Delete "${entry.name}"?`);
  }

  return (
    <div
      className="tree-row tree-file"
      style={{ paddingLeft: TREE_BASE_PADDING_PX + depth * TREE_INDENT_PX }}
      onClick={() => !renaming && onOpenFile(entry.path)}
      onContextMenu={openMenu}
    >
      <span className="tree-indent" />
      <FileIcon name={entry.name} />
      {renaming ? (
        <NameInput
          initialValue={entry.name}
          onSubmit={submitRename}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <span className="tree-name">{entry.name}</span>
      )}
      {position && (
        <ContextMenu
          x={position.x}
          y={position.y}
          onClose={closeMenu}
          items={[
            { label: "Rename", onClick: () => setRenaming(true) },
            { label: "Delete", onClick: deleteFile, danger: true },
          ]}
        />
      )}
    </div>
  );
}
