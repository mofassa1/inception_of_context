import { useState } from "react";
import { Sparkles, Trash2, X } from "lucide-react";
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

const STUB_REPLY =
  "The AI agent isn't connected yet — once wired up it will reply here and can edit files in your workspace.";

export function ChatPanel({
  open,
  onClose,
  width,
  onResize,
}: {
  open: boolean;
  onClose: () => void;
  width: number;
  onResize: (width: number) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  function send(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const now = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text, at: now },
      { id: crypto.randomUUID(), role: "assistant", text: STUB_REPLY, at: now + 1 },
    ]);
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
              title="Clear conversation"
              aria-label="Clear conversation"
              onClick={() => setMessages([])}
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
        <ChatMessages messages={messages} open={open} />
        <ChatComposer draft={draft} onDraftChange={setDraft} onSend={send} />
      </div>
    </div>
  );
}
