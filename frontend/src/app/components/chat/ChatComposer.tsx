import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";

const MAX_HEIGHT = 160;

export function ChatComposer({
  draft,
  busy,
  onDraftChange,
  onSend,
  onStop,
}: {
  draft: string;
  busy: boolean;
  onDraftChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + "px";
  }, [draft]);

  function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    onSend(text);
    onDraftChange("");
  }

  return (
    <div className="chat-composer">
      <div className="chat-input">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={draft}
          placeholder="Ask the agent…"
          rows={1}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {busy ? (
          <button
            className="chat-send chat-stop"
            aria-label="Stop"
            onClick={onStop}
          >
            <Square size={12} fill="currentColor" />
          </button>
        ) : (
          <button
            className="chat-send"
            aria-label="Send message"
            disabled={!draft.trim()}
            onClick={submit}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>
      <div className="chat-hint">
        <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
      </div>
    </div>
  );
}
