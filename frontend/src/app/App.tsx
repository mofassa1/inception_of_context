import { useEffect, useRef, useState } from "react";
import { chooseFolder } from "./api.js";
import { addRecentFolder } from "./recentFolders.js";
import { ActivityBar } from "./components/ActivityBar.js";
import { TitleBar } from "./components/TitleBar.js";
import { Welcome } from "./components/Welcome.js";
import { ChatPanel } from "./components/chat/ChatPanel.js";
import { OverviewPanel } from "./components/overview/OverviewPanel.js";
import type { WorkspaceView } from "./components/ViewSwitch.js";
import { Sidebar } from "./components/sidebar/Sidebar.js";
import { Editor } from "./components/editor/Editor.js";
import { StatusBar } from "./components/editor/StatusBar.js";
import { Tabs } from "./components/editor/Tabs.js";
import { useTabs } from "./useTabs.js";

declare global {
  interface Window {
    ide?: {
      pickFolder(): Promise<string | null>;
      minimize(): void;
      toggleMaximize(): void;
      close(): void;
      isMaximized(): Promise<boolean>;
      onMaximizeChange(cb: (value: boolean) => void): () => void;
      onMenu(cb: (action: string) => void): () => void;
    };
  }
}

const APP_NAME = "not vscode";

export function App() {
  const [root, setRoot] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(380);
  const [view, setView] = useState<WorkspaceView>("editor");
  const tabs = useTabs();

  const folderName = root ? root.split("/").pop() || root : null;
  const activeName = tabs.activeTab?.path.split("/").pop() ?? null;

  const closeAllTabs = useRef(tabs.closeAll);
  closeAllTabs.current = tabs.closeAll;

  function openFolder(path: string) {
    addRecentFolder(path);
    setRoot(path);
  }

  useEffect(() => {
    document.title = [activeName, folderName, APP_NAME].filter(Boolean).join(" — ");
  }, [activeName, folderName]);

  useEffect(() => {
    return window.ide?.onMenu(async (action) => {
      if (action === "open-folder") {
        try {
          const picked = await chooseFolder();
          if (picked) openFolder(picked);
        } catch (err) {
          alert("Couldn't open folder: " + (err as Error).message);
        }
      } else if (action === "close-folder") {
        setRoot(null);
        closeAllTabs.current();
      } else if (action === "toggle-chat") {
        setChatOpen((v) => !v);
      }
    });
  }, []);

  return (
    <>
      <TitleBar
        label={folderName ?? APP_NAME}
        title={root ?? undefined}
        showSwitch={!!root}
        view={view}
        onViewChange={setView}
      />
      {!root ? (
        <Welcome onOpen={openFolder} />
      ) : (
        <>
        <div className="ide" hidden={view !== "editor"}>
          <Sidebar
            root={root}
            onOpenFile={tabs.openFile}
            onPathRemoved={tabs.handleTreeRemoved}
            onPathRenamed={tabs.handleTreeRenamed}
          />
          <div className="main">
            <Tabs
              tabs={tabs.tabs}
              activePath={tabs.active}
              onSelect={tabs.switchTab}
              onClose={tabs.closeTab}
            />
            {tabs.activeTab ? (
              <Editor
                path={tabs.activeTab.path}
                currentState={tabs.activeTab.state}
                onChange={tabs.onDocChange}
              />
            ) : (
              <div className="editor-empty" />
            )}
            <StatusBar tab={tabs.activeTab} />
          </div>
          <ChatPanel
            root={root}
            open={chatOpen}
            onClose={() => setChatOpen(false)}
            width={chatWidth}
            onResize={setChatWidth}
          />
          <ActivityBar chatOpen={chatOpen} onToggleChat={() => setChatOpen((v) => !v)} />
        </div>
        {view === "overview" && <OverviewPanel root={root} />}
        </>
      )}
    </>
  );
}
