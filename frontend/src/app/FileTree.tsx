import { useEffect, useRef, useState } from "react";
import type { Entry } from "./api.js";
import { useDirEntries } from "./hooks/useDirEntries.js";
import { useCreateEntry, useDeleteEntry, useRenameEntry } from "./hooks/useFileTreeMutations.js";

type TreeCallbacks = {
  onOpenFile: (path: string) => void;
  onPathRemoved: (path: string) => void;
  onPathRenamed: (oldPath: string, newPath: string) => void;
};

type RowProps = TreeCallbacks & { entry: Entry; depth: number };

export function FileTree({ root, ...callbacks }: TreeCallbacks & { root: string }) {
  const { data: entries, error } = useDirEntries(root);
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

function DirRow({ entry, depth, onOpenFile, onPathRemoved, onPathRenamed }: RowProps) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [creating, setCreating] = useState<"file" | "dir" | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const { data: entries, error } = useDirEntries(entry.path, open);
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
        <span className="tree-caret">▸</span>
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

function FileRow({ entry, depth, onOpenFile, onPathRemoved, onPathRenamed }: RowProps) {
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

function NameInput({
  initial = "",
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className="tree-name-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          doneRef.current = true;
          onSubmit(value.trim());
        } else if (e.key === "Escape") {
          doneRef.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (!doneRef.current) onCancel();
      }}
    />
  );
}

function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: { label: string; onClick: () => void; danger?: boolean }[];
  onClose: () => void;
}) {
  useEffect(() => {
    window.addEventListener("click", onClose);
    window.addEventListener("contextmenu", onClose);
    return () => {
      window.removeEventListener("click", onClose);
      window.removeEventListener("contextmenu", onClose);
    };
  }, [onClose]);

  return (
    <div className="context-menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      {items.map((it) => (
        <div
          key={it.label}
          className={"context-menu-item" + (it.danger ? " danger" : "")}
          onClick={() => {
            onClose();
            it.onClick();
          }}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}
