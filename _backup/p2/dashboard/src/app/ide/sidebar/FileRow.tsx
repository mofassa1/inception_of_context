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
import { IgnoreToggle } from "./IgnoreToggle";
import { NameInput } from "./NameInput";
import { useContextMenu } from "./hooks/useContextMenu";
import { useEntryActions } from "./hooks/useEntryActions";

type FileRowProps = FileTreeCallbacks & {
  entry: DirectoryEntry;
  depth: number;
  isIgnored: (entryPath: string, entryName: string) => boolean;
  onToggleIgnored: (entryPath: string) => void;
};

export function FileRow({
  entry,
  depth,
  isIgnored,
  onToggleIgnored,
  onOpenFile,
  onPathRemoved,
  onPathRenamed,
}: FileRowProps) {
  const ignored = isIgnored(entry.path, entry.name);
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
      className={"tree-row tree-file" + (ignored ? " ignored" : "")}
      style={{ paddingLeft: TREE_BASE_PADDING_PX + depth * TREE_INDENT_PX }}
      onClick={() => !renaming && onOpenFile(entry.path)}
      onContextMenu={openMenu}
    >
      <IgnoreToggle
        ignored={ignored}
        label={entry.name}
        onToggle={() => onToggleIgnored(entry.path)}
      />
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
