import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { COMPOSER_MAX_HEIGHT } from "@/shared/constants/config";
import type { ChatMode } from "@/shared/types/chat";
import { ChatModeToggle } from "./ChatModeToggle";

export function ChatComposer({
  draft,
  mode,
  isStreaming,
  onModeChange,
  onDraftChange,
  onSend,
  onStop,
}: {
  draft: string;
  mode: ChatMode;
  isStreaming: boolean;
  onModeChange: (mode: ChatMode) => void;
  onDraftChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = draft.trim();
    if (!text || isStreaming) return;

    onSend(text);
    onDraftChange("");
  }

  function resizeTextarea() {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = "auto";
    element.style.height =
      Math.min(element.scrollHeight, COMPOSER_MAX_HEIGHT) + "px";
  }

  useEffect(() => {
    resizeTextarea();
  }, [draft]);

  return (
    <div className="chat-composer">
      <div className="chat-input">
        <div className="chat-input-toolbar">
          <ChatModeToggle
            value={mode}
            disabled={isStreaming}
            onChange={onModeChange}
          />
        </div>

        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={draft}
            placeholder={
              mode === "agent" ? "Describe a change…" : "Ask about this codebase…"
            }
            rows={1}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submit();
              }
            }}
          />
          {isStreaming ? (
            <button
              className="chat-send chat-stop"
              aria-label="Stop"
              onClick={onStop}
            >
              <Square size={11} fill="currentColor" />
            </button>
          ) : (
            <button
              className="chat-send"
              aria-label="Send message"
              disabled={!draft.trim()}
              onClick={submit}
            >
              <ArrowUp size={15} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      <div className="chat-hint">
        <kbd>Enter</kbd> send · <kbd>Shift</kbd><kbd>Enter</kbd> newline
      </div>
    </div>
  );
}
