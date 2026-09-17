import { TREE_BASE_PADDING_PX } from "@/shared/constants/config";
import type { FileTreeCallbacks } from "@/shared/types/filesystem";
import { ContextMenu } from "./ContextMenu";
import { DirRow } from "./DirRow";
import { FileRow } from "./FileRow";
import { NameInput } from "./NameInput";
import { useContextMenu } from "./hooks/useContextMenu";
import { useCreateEntry } from "./hooks/useCreateEntry";
import { useListFolder } from "./hooks/useListFolder";

type FileTreeProps = FileTreeCallbacks & {
  root: string;
  creating: "file" | "dir" | null;
  onCreatingChange: (kind: "file" | "dir" | null) => void;
  isIgnored: (entryPath: string) => boolean;
  onToggleIgnored: (entryPath: string) => void;
};

export function FileTree({
  root,
  creating,
  onCreatingChange,
  ...callbacks
}: FileTreeProps) {
  const { position, openMenuOnSelf, closeMenu } = useContextMenu();
  const { listFolderOutput, listFolderError } = useListFolder({ path: root });
  const entries = listFolderOutput?.entries ?? [];
  const { createEntry } = useCreateEntry();

  async function submitCreate(name: string, isDirectory: boolean) {
    onCreatingChange(null);
    if (!name) return;

    try {
      await createEntry({ path: root + "/" + name, is_dir: isDirectory });
    } catch (createError) {
      alert("Couldn't create: " + (createError as Error).message);
    }
  }

  return (
    <div className="min-h-[120px] flex-1 pt-0.5 pb-2" onContextMenu={openMenuOnSelf}>
      {listFolderError && <div className="px-5 py-1.5 text-[12px] text-danger">{listFolderError.message}</div>}

      {creating && (
        <div className="flex h-[22px] cursor-pointer items-center gap-[5px] overflow-hidden pr-3 text-[13px] text-ellipsis whitespace-nowrap text-fg select-none hover:bg-list-hover" style={{ paddingLeft: TREE_BASE_PADDING_PX }}>
          <NameInput
            placeholder={creating === "dir" ? "folder name" : "file name"}
            onSubmit={(name) => submitCreate(name, creating === "dir")}
            onCancel={() => onCreatingChange(null)}
          />
        </div>
      )}

      {entries.map((entry) =>
        entry.is_dir ? (
          <DirRow key={entry.path} entry={entry} depth={0} {...callbacks} />
        ) : (
          <FileRow key={entry.path} entry={entry} depth={0} {...callbacks} />
        ),
      )}

      {position && (
        <ContextMenu
          x={position.x}
          y={position.y}
          onClose={closeMenu}
          items={[
            { label: "New File", onClick: () => onCreatingChange("file") },
            { label: "New Folder", onClick: () => onCreatingChange("dir") },
          ]}
        />
      )}
    </div>
  );
}
