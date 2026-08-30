import { useRef, useState } from "react";
import { RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { askAgentStream, indexWorkspace } from "../../api.js";
import { ChatComposer } from "./ChatComposer.js";
import { ChatMessages } from "./ChatMessages.js";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
};

const MIN_WIDTH = 300;
const MAX_WIDTH = 640;

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function patchMessage(id: string, text: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text } : m)));
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;

    const now = Date.now();
    const replyId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text, at: now },
      { id: replyId, role: "assistant", text: "", at: now + 1 },
    ]);

    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let answer = "";
    try {
      await askAgentStream(
        text,
        (chunk) => {
          answer += chunk;
          patchMessage(replyId, answer);
        },
        controller.signal,
      );
      if (!answer) patchMessage(replyId, "(no response)");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        patchMessage(replyId, answer || `⚠ ${(err as Error).message}`);
      } else if (!answer) {
        patchMessage(replyId, "(stopped)");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function clear() {
    abortRef.current?.abort();
    setMessages([]);
    setNote(null);
  }

  async function reindex() {
    if (indexing) return;
    setIndexing(true);
    setNote("Indexing workspace…");
    try {
      const res = await indexWorkspace(root);
      setNote(`Indexed ${res.chunks_indexed} chunks from ${res.files_indexed} files.`);
    } catch (err) {
      setNote(`Indexing failed: ${(err as Error).message}`);
    } finally {
      setIndexing(false);
    }
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    function onMove(ev: MouseEvent) {
      const next = startWidth + (startX - ev.clientX);
      onResize(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("resizing");
    }

    document.body.classList.add("resizing");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
              disabled={indexing}
              onClick={reindex}
            >
              <RefreshCw size={14} className={indexing ? "spin" : undefined} />
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
        <ChatMessages messages={messages} open={open} busy={busy} />
        <ChatComposer
          draft={draft}
          busy={busy}
          onDraftChange={setDraft}
          onSend={send}
          onStop={() => abortRef.current?.abort()}
        />
      </div>
    </div>
  );
}
