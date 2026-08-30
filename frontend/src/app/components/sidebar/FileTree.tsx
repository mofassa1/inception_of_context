import { useState } from "react";
import { type TreeCallbacks, useCreateEntry, useDirectory } from "../../fileTree.js";
import { ContextMenu } from "./ContextMenu.js";
import { DirRow } from "./DirRow.js";
import { FileRow } from "./FileRow.js";
import { NameInput } from "./NameInput.js";

export function FileTree({ root, ...callbacks }: TreeCallbacks & { root: string }) {
  const { data: entries, error } = useDirectory(root);
  const createEntry = useCreateEntry();
  const [creating, setCreating] = useState<"file" | "dir" | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  async function doCreate(name: string, isDir: boolean) {
    setCreating(null);
    if (!name) return;
    try {
      await createEntry.mutateAsync({ path: root + "/" + name, isDir });
    } catch (err) {
      alert("Couldn't create: " + (err as Error).message);
    }
  }

  return (
    <div
      className="tree"
      onContextMenu={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {error && <div className="tree-error">{(error as Error).message}</div>}
      {creating && (
        <div className="tree-row" style={{ paddingLeft: 8 }}>
          <NameInput
            placeholder={creating === "dir" ? "folder name" : "file name"}
            onSubmit={(name) => doCreate(name, creating === "dir")}
            onCancel={() => setCreating(null)}
          />
        </div>
      )}
      {entries?.map((e) =>
        e.is_dir ? (
          <DirRow key={e.path} entry={e} depth={0} {...callbacks} />
        ) : (
          <FileRow key={e.path} entry={e} depth={0} {...callbacks} />
        ),
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "New File", onClick: () => setCreating("file") },
            { label: "New Folder", onClick: () => setCreating("dir") },
          ]}
        />
      )}
    </div>
  );
}
