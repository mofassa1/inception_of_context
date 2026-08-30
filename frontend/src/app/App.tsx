import { useState } from "react";
import { EditorPane } from "./EditorPane.js";
import { FileTree } from "./FileTree.js";
import { useOpenFolder } from "./hooks/useOpenFolder.js";
import { useTabs } from "./hooks/useTabs.js";

declare global {
  interface Window {
    ide?: { pickFolder(): Promise<string | null> };
  }
}

export function App() {
  const [root, setRoot] = useState<string | null>(null);
  const tabs = useTabs();

  if (!root) return <Welcome onOpen={setRoot} />;

  return (
    <div className="ide">
      <Sidebar
        root={root}
        onOpenFile={tabs.openFile}
        onPathRemoved={tabs.handleTreeRemoved}
        onPathRenamed={tabs.handleTreeRenamed}
      />
      <div className="main">
        <TabBar tabs={tabs.tabs} active={tabs.active} onSwitch={tabs.switchTab} onClose={tabs.closeTab} />
        <EditorPane currentState={tabs.activeTab?.state ?? null} onChange={tabs.onDocChange} />
        <StatusLine tab={tabs.activeTab} />
      </div>
    </div>
  );
}

function Sidebar({
  root,
  onOpenFile,
  onPathRemoved,
  onPathRenamed,
}: {
  root: string;
  onOpenFile: (path: string) => void;
  onPathRemoved: (path: string) => void;
  onPathRenamed: (oldPath: string, newPath: string) => void;
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-head">{root.split("/").pop() || root}</div>
      <FileTree root={root} onOpenFile={onOpenFile} onPathRemoved={onPathRemoved} onPathRenamed={onPathRenamed} />
    </div>
  );
}

function TabBar({
  tabs,
  active,
  onSwitch,
  onClose,
}: {
  tabs: ReturnType<typeof useTabs>["tabs"];
  active: string | null;
  onSwitch: (path: string) => void;
  onClose: (path: string) => void;
}) {
  return (
    <div className="tabbar">
      {tabs.map((t) => (
        <div
          key={t.path}
          className={"tab" + (t.path === active ? " active" : "")}
          onClick={() => onSwitch(t.path)}
        >
          <span className="tab-name">{t.path.split("/").pop()}</span>
          <span
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(t.path);
            }}
          >
            ×
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusLine({ tab }: { tab: ReturnType<typeof useTabs>["activeTab"] }) {
  if (!tab) return <div className="statusline" />;
  const label =
    tab.status === "saving" ? "saving…" : tab.status === "error" ? "error: " + tab.error : "saved";
  return (
    <div className="statusline">
      <span className={"status-word status-" + tab.status}>{label}</span>
      <span className="status-path">{tab.path}</span>
    </div>
  );
}

function Welcome({ onOpen }: { onOpen: (path: string) => void }) {
  const openFolder = useOpenFolder();

  async function pickAndOpen() {
    const picked = await window.ide?.pickFolder();
    if (picked) openFolder.mutate(picked, { onSuccess: onOpen });
  }

  return (
    <div className="ide-empty">
      <div className="ide-empty-card">
        <h1>mini IDE</h1>
        <p className="muted">Open a folder to start editing.</p>
        <button className="navbtn primary" disabled={openFolder.isPending} onClick={pickAndOpen}>
          Open Folder…
        </button>
        {openFolder.isError && <p className="tree-error">{(openFolder.error as Error).message}</p>}
      </div>
    </div>
  );
}
