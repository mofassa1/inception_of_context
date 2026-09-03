import { RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { CHAT_MAX_WIDTH, CHAT_MIN_WIDTH } from "@/shared/constants/config";
import { ChatComposer } from "./ChatComposer";
import { ChatMessages } from "./ChatMessages";
import { useChat } from "./hooks/useChat";
import { useIndexWorkspace } from "./hooks/useIndexWorkspace";
import { useResizable } from "./hooks/useResizable";
import "./chat.css";

export function ChatPanel({
  root,
  open,
  onClose,
  width,
  onResize,
}: {
  root: string;
  open: boolean;
  onClose: () => void;
  width: number;
  onResize: (width: number) => void;
}) {
  const { messages, draft, setDraft, send, stop, clear, isStreaming } = useChat();
  const { indexWorkspace, result, error, isPending } = useIndexWorkspace();
  const { startResize } = useResizable({
    width,
    minWidth: CHAT_MIN_WIDTH,
    maxWidth: CHAT_MAX_WIDTH,
    onResize,
  });

  const note = isPending
    ? "Indexing workspace…"
    : error
      ? `Indexing failed: ${error.message}`
      : result
        ? `Indexed ${result.chunks_indexed} chunks from ${result.files_indexed} files.`
        : null;

  function reindex() {
    if (isPending) return;
    indexWorkspace(root).catch(() => undefined);
  }

  return (
    <div className="chat-panel" style={{ width: open ? width : 0 }} inert={!open}>
      <div className="chat-inner" style={{ width }}>
        <div className="chat-resize" onMouseDown={startResize} />

        <div className="chat-head">
          <div className="chat-head-title">
            <Sparkles size={14} className="chat-head-icon" />
            <span>Chat</span>
          </div>
          <div className="chat-head-actions">
            <button
              className="icon-btn"
              title="Index workspace"
              aria-label="Index workspace"
              disabled={isPending}
              onClick={reindex}
            >
              <RefreshCw size={14} className={isPending ? "spin" : undefined} />
            </button>
            <button
              className="icon-btn"
              title="Clear conversation"
              aria-label="Clear conversation"
              onClick={clear}
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

        <ChatMessages messages={messages} open={open} isStreaming={isStreaming} />

        <ChatComposer
          draft={draft}
          isStreaming={isStreaming}
          onDraftChange={setDraft}
          onSend={send}
          onStop={stop}
        />
      </div>
    </div>
  );
}
