import { useState } from "react";
import { FileIcon } from "@/shared/components/FileIcons";
import {
  TREE_BASE_PADDING_PX,
  TREE_INDENT_PX,
} from "@/shared/constants/config";
import type { FolderEntryDTO } from "@/shared/types/dto";
import type { FileTreeCallbacks } from "@/shared/types/filesystem";
import { ContextMenu } from "./ContextMenu";
import { IgnoreToggle } from "./IgnoreToggle";
import { NameInput } from "./NameInput";
import { useContextMenu } from "./hooks/useContextMenu";
import { useEntryActions } from "./hooks/useEntryActions";

type FileRowProps = FileTreeCallbacks & {
  entry: FolderEntryDTO;
  depth: number;
  isIgnored: (entryPath: string) => boolean;
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
  const ignored = isIgnored(entry.path);
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
      className="flex h-[22px] cursor-pointer items-center gap-[5px] overflow-hidden pr-3 text-[13px] text-ellipsis whitespace-nowrap text-fg select-none hover:bg-list-hover"
      style={{ paddingLeft: TREE_BASE_PADDING_PX + depth * TREE_INDENT_PX }}
      onClick={() => !renaming && onOpenFile(entry.path)}
      onContextMenu={openMenu}
    >
      <IgnoreToggle
        ignored={ignored}
        label={entry.name}
        onToggle={() => onToggleIgnored(entry.path)}
      />
      <span className="block w-[14px] shrink-0" />
      <FileIcon name={entry.name} faded={ignored} />
      {renaming ? (
        <NameInput
          initialValue={entry.name}
          onSubmit={submitRename}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <span className={"overflow-hidden text-ellipsis" + (ignored ? " opacity-42" : "")}>{entry.name}</span>
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
