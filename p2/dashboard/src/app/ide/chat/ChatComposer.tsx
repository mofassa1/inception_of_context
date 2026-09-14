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
    <div className="flex-none border-t border-border px-3 pt-2.5 pb-[9px]">
      <div className="rounded-[11px] border border-focus bg-input-bg transition-[border-color] duration-140 focus-within:border-accent">
        <div className="flex min-w-0 items-center gap-2 px-[7px] pt-1.5">
          <ChatModeToggle
            value={mode}
            disabled={isStreaming}
            onChange={onModeChange}
          />
        </div>

        <div className="flex items-end gap-1.5 pt-1 pr-1.5 pb-1.5 pl-2.5">
          <textarea
            ref={textareaRef}
            className="max-h-[160px] min-w-0 flex-1 resize-none border-none bg-transparent py-1 [font:inherit] text-[12.5px] leading-normal text-fg-strong outline-none placeholder:text-fg-dim"
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
              className="grid size-[26px] flex-none cursor-pointer place-items-center rounded-full border-none text-white transition-[opacity,background-color] duration-140 bg-danger hover:brightness-112"
              aria-label="Stop"
              onClick={onStop}
            >
              <Square size={11} fill="currentColor" />
            </button>
          ) : (
            <button
              className="grid size-[26px] flex-none cursor-pointer place-items-center rounded-full border-none text-white transition-[opacity,background-color] duration-140 bg-accent enabled:hover:brightness-112 disabled:cursor-default disabled:opacity-30"
              aria-label="Send message"
              disabled={!draft.trim()}
              onClick={submit}
            >
              <ArrowUp size={15} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-[3px] px-1 pt-1.5 text-[10px] text-fg-dim">
        <kbd className="rounded-[3px] border border-focus bg-chrome-bg px-[3px] [font:inherit] text-[9.5px]">Enter</kbd> send · <kbd className="rounded-[3px] border border-focus bg-chrome-bg px-[3px] [font:inherit] text-[9.5px]">Shift</kbd>
        <kbd className="rounded-[3px] border border-focus bg-chrome-bg px-[3px] [font:inherit] text-[9.5px]">Enter</kbd> newline
      </div>
    </div>
  );
}
