import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { FolderIcon } from "@/shared/components/FileIcons";
import {
  TREE_BASE_PADDING_PX,
  TREE_INDENT_PX,
} from "@/shared/constants/config";
import type { FolderEntryDTO } from "@/shared/types/dto";
import type { FileTreeCallbacks } from "@/shared/types/filesystem";
import { ContextMenu } from "./ContextMenu";
import { FileRow } from "./FileRow";
import { IgnoreToggle } from "./IgnoreToggle";
import { NameInput } from "./NameInput";
import { useContextMenu } from "./hooks/useContextMenu";
import { useListFolder } from "./hooks/useListFolder";
import { useEntryActions } from "./hooks/useEntryActions";

type DirRowProps = FileTreeCallbacks & {
  entry: FolderEntryDTO;
  depth: number;
  isIgnored: (entryPath: string) => boolean;
  onToggleIgnored: (entryPath: string) => void;
};

export function DirRow({
  entry,
  depth,
  isIgnored,
  onToggleIgnored,
  onOpenFile,
  onPathRemoved,
  onPathRenamed,
}: DirRowProps) {
  const ignored = isIgnored(entry.path);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [creating, setCreating] = useState<"file" | "dir" | null>(null);

  const { position, openMenu, closeMenu } = useContextMenu();
  const { listFolderOutput, listFolderError } = useListFolder(
    { path: entry.path },
    open && !ignored,
  );
  const entries = listFolderOutput?.entries ?? [];
  const { renameTo, remove, createChild } = useEntryActions(entry, {
    onPathRemoved,
    onPathRenamed,
  });

  const callbacks = {
    onOpenFile,
    onPathRemoved,
    onPathRenamed,
    isIgnored,
    onToggleIgnored,
  };

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
    <div>
      <div
        className="flex h-[22px] cursor-pointer items-center gap-[5px] overflow-hidden pr-3 text-[13px] text-ellipsis whitespace-nowrap text-fg select-none hover:bg-list-hover"
        style={{ paddingLeft: TREE_BASE_PADDING_PX + depth * TREE_INDENT_PX }}
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        onContextMenu={openMenu}
      >
        <IgnoreToggle
          ignored={ignored}
          label={entry.name}
          onToggle={() => onToggleIgnored(entry.path)}
        />
        <ChevronRight
          className={"block shrink-0 text-fg opacity-75 transition-transform duration-100 ease-linear" + (open ? " rotate-90" : "")}
          size={14}
          strokeWidth={2.5}
        />
        <FolderIcon open={open} faded={ignored} />
        {renaming ? (
          <NameInput
            initialValue={entry.name}
            onSubmit={submitRename}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span className={"overflow-hidden text-ellipsis" + (ignored ? " opacity-42" : "")}>{entry.name}</span>
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
        <div>
          {listFolderError && <div className="px-5 py-1.5 text-[12px] text-danger">{listFolderError.message}</div>}
          {creating && (
            <div
              className="flex h-[22px] cursor-pointer items-center gap-[5px] overflow-hidden pr-3 text-[13px] text-ellipsis whitespace-nowrap text-fg select-none hover:bg-list-hover"
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
