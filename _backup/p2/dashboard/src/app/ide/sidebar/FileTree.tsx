import { TREE_BASE_PADDING_PX } from "@/shared/constants/config";
import type { FileTreeCallbacks } from "@/shared/types/filesystem";
import { ContextMenu } from "./ContextMenu";
import { DirRow } from "./DirRow";
import { FileRow } from "./FileRow";
import { NameInput } from "./NameInput";
import { useContextMenu } from "./hooks/useContextMenu";
import { useCreateEntry } from "./hooks/useCreateEntry";
import { useDirectory } from "./hooks/useDirectory";

type FileTreeProps = FileTreeCallbacks & {
  root: string;
  creating: "file" | "dir" | null;
  onCreatingChange: (kind: "file" | "dir" | null) => void;
  isIgnored: (entryPath: string, entryName: string) => boolean;
  onToggleIgnored: (entryPath: string) => void;
};

export function FileTree({
  root,
  creating,
  onCreatingChange,
  ...callbacks
}: FileTreeProps) {
  const { position, openMenuOnSelf, closeMenu } = useContextMenu();
  const { entries, error } = useDirectory(root);
  const { createEntry } = useCreateEntry();

  async function submitCreate(name: string, isDirectory: boolean) {
    onCreatingChange(null);
    if (!name) return;

    try {
      await createEntry({ entryPath: root + "/" + name, isDirectory });
    } catch (createError) {
      alert("Couldn't create: " + (createError as Error).message);
    }
  }

  return (
    <div className="tree" onContextMenu={openMenuOnSelf}>
      {error && <div className="tree-error">{error.message}</div>}

      {creating && (
        <div className="tree-row" style={{ paddingLeft: TREE_BASE_PADDING_PX }}>
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
