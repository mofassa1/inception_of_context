import { useMemo, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  CHAT_DEFAULT_WIDTH,
  CHAT_WIDTH_KEY,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_WIDTH_KEY,
} from "@/shared/constants/config";
import { useStoredWidth } from "@/shared/hooks/useStoredWidth";
import { isPathIgnored } from "@/shared/lib/isPathIgnored";
import { useGetFile } from "@/shared/hooks/useGetFile";
import type { ChunkDTO, IgnoreRuleDTO } from "@/shared/types/dto";
import { ActivityBar } from "./ActivityBar";
import { ChatPanel } from "./chat/ChatPanel";
import { Editor } from "./editor/Editor";
import { StatusBar } from "./editor/StatusBar";
import { Tabs } from "./editor/Tabs";
import { Sidebar } from "./sidebar/Sidebar";
import type { useTabs } from "./editor/hooks/useTabs";
import { useListIgnoreRules } from "./sidebar/hooks/useListIgnoreRules";
import { useSetIgnoreRule } from "./sidebar/hooks/useSetIgnoreRule";

const NO_CHUNKS: ChunkDTO[] = [];
const NO_IGNORE_RULES: IgnoreRuleDTO[] = [];

export function IdeView({
  root,
  onCloseFolder,
  hidden,
  chatOpen,
  onToggleChat,
  onCloseChat,
  tabs,
}: {
  root: string;
  onCloseFolder: () => void;
  hidden: boolean;
  chatOpen: boolean;
  onToggleChat: () => void;
  onCloseChat: () => void;
  tabs: ReturnType<typeof useTabs>;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
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
  const { fileOutput } = useGetFile(activePath, showChunks);
  const chunks = useMemo(
    () => (fileOutput ? fileOutput.chunks : NO_CHUNKS),
    [fileOutput],
  );

  const { listIgnoreRulesOutput } = useListIgnoreRules(conversationId);
  const { setIgnoreRule } = useSetIgnoreRule();
  const ignoreRules = listIgnoreRulesOutput?.rules ?? NO_IGNORE_RULES;

  function isIgnored(entryPath: string) {
    return isPathIgnored(entryPath, root, ignoreRules);
  }

  function toggleIgnored(entryPath: string) {
    if (!conversationId) return;

    setIgnoreRule({
      conversationId,
      body: { pattern: entryPath, isIgnored: !isIgnored(entryPath) },
    }).catch(() => undefined);
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden" hidden={hidden}>
      <Sidebar
        root={root}
        onCloseFolder={onCloseFolder}
        width={sidebarWidth}
        onResize={setSidebarWidth}
        isIgnored={isIgnored}
        onToggleIgnored={toggleIgnored}
        onOpenFile={tabs.openFile}
        onPathRemoved={tabs.handlePathRemoved}
        onPathRenamed={tabs.handlePathRenamed}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-editor-bg">
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
          <div className="min-h-0 flex-1 overflow-hidden bg-editor-bg" />
        )}
        <StatusBar
          tab={tabs.activeTab}
          chunkCount={chunks.length}
          showChunks={showChunks}
          onToggleChunks={() => setShowChunks((visible) => !visible)}
        />
      </div>

      <ChatPanel
        root={root}
        conversationId={conversationId}
        onConversationChange={setConversationId}
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
