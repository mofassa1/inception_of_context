import { MessageSquarePlus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { CHAT_MAX_WIDTH, CHAT_MIN_WIDTH } from "@/shared/constants/config";
import { useIndexWorkspace } from "@/shared/hooks/useIndexWorkspace";
import { useResizable } from "@/shared/hooks/useResizable";
import type { IgnoreRules, PatchProposal } from "@/shared/types/agent";
import { ChatComposer } from "./ChatComposer";
import { ChatMessages } from "./ChatMessages";
import { ConversationPicker } from "./ConversationPicker";
import { useEffect, useState } from "react";
import { useApplyPatch } from "./hooks/useApplyPatch";
import { useChat } from "./hooks/useChat";
import { useConversations } from "./hooks/useConversations";

import "./chat.css";

export function ChatPanel({
  root,
  rules,
  open,
  onClose,
  width,
  onResize,
  onOpenFile,
}: {
  root: string;
  rules: IgnoreRules;
  open: boolean;
  onClose: () => void;
  width: number;
  onResize: (width: number) => void;
  onOpenFile: (filePath: string) => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);

  const { conversations, isLoading: loadingConversations, createConversation, deleteConversation } =
    useConversations();
  const chat = useChat(conversationId);

  async function startConversation() {
    const created = await createConversation();
    setConversationId(created.id);
  }

  async function removeConversation(id: string) {
    await deleteConversation(id);
    if (id === conversationId) setConversationId(null);
  }
  const { applyPatch, isPending: applying } = useApplyPatch();
  const { indexWorkspace, result, error, isPending: indexing } =
    useIndexWorkspace();
  const { startResize } = useResizable({
    width,
    minWidth: CHAT_MIN_WIDTH,
    maxWidth: CHAT_MAX_WIDTH,
    edge: "leading",
    onResize,
  });

  const note = indexing
    ? "Indexing workspace…"
    : error
      ? `Indexing failed: ${error.message}`
      : result
        ? `Indexed ${result.chunksIndexed} chunks from ${result.filesIndexed} files.`
        : null;

  function reindex() {
    if (indexing) return;
    indexWorkspace({ path: root, rules }).catch(() => undefined);
  }

  function acceptPatch(messageId: string, proposal: PatchProposal) {
    applyPatch({ files: proposal.files, rules })
      .then((applied) => {
        chat.setPatchStatus(messageId, "applied");
        const first = applied.applied[0];
        if (first) onOpenFile(first);
      })
      .catch((error) => alert("Applying the patch failed: " + (error as Error).message));
  }

  useEffect(() => {
    if (loadingConversations || conversationId) return;

    if (conversations.length > 0) {
      setConversationId(conversations[0].id);
      return;
    }

    startConversation().catch(() => undefined);
  }, [loadingConversations, conversations, conversationId]);

  return (
    <div className="chat-panel" style={{ width: open ? width : 0 }} inert={!open}>
      <div className="chat-inner" style={{ width }}>
        <div className="chat-resize" onMouseDown={startResize} />

        <div className="chat-head">
          <Sparkles size={14} className="chat-head-icon" />

          <ConversationPicker
            conversations={conversations}
            activeId={conversationId}
            disabled={chat.isBusy}
            onSelect={setConversationId}
          />

          <div className="chat-head-actions">
            <button
              className="icon-btn"
              title="New conversation"
              aria-label="New conversation"
              disabled={chat.isBusy}
              onClick={() => startConversation().catch(() => undefined)}
            >
              <MessageSquarePlus size={14} />
            </button>
            <button
              className="icon-btn"
              title="Re-index workspace"
              aria-label="Re-index workspace"
              disabled={indexing}
              onClick={reindex}
            >
              <RefreshCw size={14} className={indexing ? "spin" : undefined} />
            </button>
            <button
              className="icon-btn"
              title="Delete conversation"
              aria-label="Delete conversation"
              disabled={chat.isBusy || !conversationId}
              onClick={() =>
                conversationId &&
                removeConversation(conversationId).catch(() => undefined)
              }
            >
              <Trash2 size={14} />
            </button>
            <button
              className="icon-btn"
              title="Close chat"
              aria-label="Close chat"
              onClick={onClose}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {note && <div className="chat-note">{note}</div>}

        <ChatMessages
          messages={chat.messages}
          open={open}
          isStreaming={chat.isStreaming}
          applying={applying}
          onOpenFile={onOpenFile}
          root={root}
          onAcceptPatch={acceptPatch}
          onRejectPatch={(messageId) => chat.setPatchStatus(messageId, "rejected")}
        />



        <ChatComposer
          draft={chat.draft}
          mode={chat.mode}
          isStreaming={chat.isBusy}
          onModeChange={chat.setMode}
          onDraftChange={chat.setDraft}
          onSend={chat.send}
          onStop={chat.stop}
        />
      </div>
    </div>
  );
}
