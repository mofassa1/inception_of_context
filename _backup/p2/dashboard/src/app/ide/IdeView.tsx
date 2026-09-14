import { useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  CHAT_DEFAULT_WIDTH,
  CHAT_WIDTH_KEY,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_WIDTH_KEY,
} from "@/shared/constants/config";
import { useStoredWidth } from "@/shared/hooks/useStoredWidth";
import type { IgnoreRules } from "@/shared/types/agent";
import { ActivityBar } from "./ActivityBar";
import { ChatPanel } from "./chat/ChatPanel";
import { Editor } from "./editor/Editor";
import { StatusBar } from "./editor/StatusBar";
import { Tabs } from "./editor/Tabs";
import { Sidebar } from "./sidebar/Sidebar";
import { useFileChunks } from "./editor/hooks/useFileChunks";
import type { useTabs } from "./editor/hooks/useTabs";
import "./ide.css";
import "./editor/editor.css";

export function IdeView({
  root,
  onCloseFolder,
  hidden,
  chatOpen,
  onToggleChat,
  onCloseChat,
  tabs,
  rules,
  indexing,
  isIgnored,
  onToggleIgnored,
}: {
  root: string;
  onCloseFolder: () => void;
  hidden: boolean;
  chatOpen: boolean;
  onToggleChat: () => void;
  onCloseChat: () => void;
  tabs: ReturnType<typeof useTabs>;
  rules: IgnoreRules;
  indexing: boolean;
  isIgnored: (entryPath: string, entryName: string) => boolean;
  onToggleIgnored: (entryPath: string) => void;
}) {
  const [chatWidth, setChatWidth] = useStoredWidth(
    CHAT_WIDTH_KEY,
    CHAT_DEFAULT_WIDTH,
  );
  const [sidebarWidth, setSidebarWidth] = useStoredWidth(
    SIDEBAR_WIDTH_KEY,
    SIDEBAR_DEFAULT_WIDTH,
  );
  const [showChunks, setShowChunks] = useState(true);

  const editorViewRef = useRef<EditorView | null>(null);

  const activePath = tabs.activeTab?.path ?? null;
  const { chunks } = useFileChunks(activePath, showChunks);

  return (
    <div className="ide" hidden={hidden}>
      <Sidebar
        root={root}
        onCloseFolder={onCloseFolder}
        width={sidebarWidth}
        onResize={setSidebarWidth}
        isIgnored={isIgnored}
        onToggleIgnored={onToggleIgnored}
        onOpenFile={tabs.openFile}
        onPathRemoved={tabs.handlePathRemoved}
        onPathRenamed={tabs.handlePathRenamed}
      />

      <div className="main">
        <Tabs
          tabs={tabs.tabs}
          activePath={tabs.activePath}
          onSelect={tabs.switchTab}
          onClose={tabs.closeTab}
        />
        {tabs.activeTab ? (
          <Editor
            path={tabs.activeTab.path}
            currentState={tabs.activeTab.state}
            chunks={showChunks ? chunks : []}
            viewRef={editorViewRef}
            onChange={tabs.handleDocumentChange}
          />
        ) : (
          <div className="editor-empty" />
        )}
        <StatusBar
          tab={tabs.activeTab}
          chunkCount={chunks.length}
          showChunks={showChunks}
          indexing={indexing}
          onToggleChunks={() => setShowChunks((visible) => !visible)}
        />
      </div>

      <ChatPanel
        root={root}
        rules={rules}
        open={chatOpen}
        onClose={onCloseChat}
        width={chatWidth}
        onResize={setChatWidth}
        onOpenFile={tabs.openFile}
      />

      <ActivityBar chatOpen={chatOpen} onToggleChat={onToggleChat} />
    </div>
  );
}
