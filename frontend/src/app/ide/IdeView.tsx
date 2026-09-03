import { useState } from "react";
import { CHAT_DEFAULT_WIDTH } from "@/shared/constants/config";
import { ActivityBar } from "./ActivityBar";
import { ChatPanel } from "./chat/ChatPanel";
import { Editor } from "./editor/Editor";
import { StatusBar } from "./editor/StatusBar";
import { Tabs } from "./editor/Tabs";
import { Sidebar } from "./sidebar/Sidebar";
import type { useTabs } from "./editor/hooks/useTabs";
import "./ide.css";
import "./editor/editor.css";

export function IdeView({
  root,
  hidden,
  chatOpen,
  onToggleChat,
  onCloseChat,
  tabs,
}: {
  root: string;
  hidden: boolean;
  chatOpen: boolean;
  onToggleChat: () => void;
  onCloseChat: () => void;
  tabs: ReturnType<typeof useTabs>;
}) {
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_WIDTH);

  return (
    <div className="ide" hidden={hidden}>
      <Sidebar
        root={root}
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
            onChange={tabs.handleDocumentChange}
          />
        ) : (
          <div className="editor-empty" />
        )}
        <StatusBar tab={tabs.activeTab} />
      </div>

      <ChatPanel
        root={root}
        open={chatOpen}
        onClose={onCloseChat}
        width={chatWidth}
        onResize={setChatWidth}
      />

      <ActivityBar chatOpen={chatOpen} onToggleChat={onToggleChat} />
    </div>
  );
}
