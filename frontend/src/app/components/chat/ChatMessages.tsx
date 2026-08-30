import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import type { ChatMessage } from "./ChatPanel.js";

export function ChatMessages({
  messages,
  open,
  busy,
}: {
  messages: ChatMessage[];
  open: boolean;
  busy: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distance < 80;
  }

  useEffect(() => {
    if (stickToBottom.current) scrollToBottom();
  }, [messages, busy]);

  useEffect(() => {
    if (open) {
      stickToBottom.current = true;
      scrollToBottom();
    }
  }, [open]);

  if (messages.length === 0) {
    return (
      <div className="chat-messages" ref={scrollRef} onScroll={onScroll}>
        <div className="chat-empty">
          <div className="chat-empty-icon">
            <Sparkles size={20} />
          </div>
          <p className="chat-empty-title">Hey — how can I help?</p>
          <p className="chat-empty-sub">
            I'm here to work through this project with you. Ask a question or
            describe a change, and I'll read and edit the files in this folder.
          </p>
        </div>
      </div>
    );
  }

  const lastId = messages[messages.length - 1]?.id;

  return (
    <div className="chat-messages" ref={scrollRef} onScroll={onScroll}>
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <div key={message.id} className="chat-row chat-row-user">
              <div className="chat-bubble">{message.text}</div>
            </div>
          );
        }

        const streaming = busy && message.id === lastId;
        return (
          <div key={message.id} className="chat-row chat-row-agent">
            <div className="chat-avatar">
              <Sparkles size={13} />
            </div>
            <div className="chat-agent-text">
              {message.text}
              {streaming && !message.text && (
                <span className="chat-dots" aria-label="Thinking">
                  <i />
                  <i />
                  <i />
                </span>
              )}
              {streaming && message.text && <span className="chat-caret" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
