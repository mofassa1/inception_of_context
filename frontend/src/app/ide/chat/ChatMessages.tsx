import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import type { ChatMessage } from "@/shared/types/chat";

const STICK_TO_BOTTOM_THRESHOLD_PX = 80;

export function ChatMessages({
  messages,
  open,
  isStreaming,
}: {
  messages: ChatMessage[];
  open: boolean;
  isStreaming: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  function scrollToBottom() {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    stickToBottomRef.current =
      distanceFromBottom < STICK_TO_BOTTOM_THRESHOLD_PX;
  }

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom();
  }, [messages, isStreaming]);

  useEffect(() => {
    if (open) {
      stickToBottomRef.current = true;
      scrollToBottom();
    }
  }, [open]);

  if (messages.length === 0) {
    return (
      <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
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

  const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <div key={message.id} className="chat-row chat-row-user">
              <div className="chat-bubble">{message.text}</div>
            </div>
          );
        }

        const streaming = isStreaming && message.id === lastMessageId;

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
