import { MessageCircleQuestion, Wand2 } from "lucide-react";
import type { ChatMode } from "@/shared/types/chat";

const MODES: { value: ChatMode; label: string; hint: string }[] = [
  { value: "ask", label: "Ask", hint: "Answer questions about this codebase" },
  { value: "agent", label: "Agent", hint: "Propose code changes to review" },
];

export function ChatModeToggle({
  value,
  disabled,
  onChange,
}: {
  value: ChatMode;
  disabled: boolean;
  onChange: (mode: ChatMode) => void;
}) {
  return (
    <div className="chat-modes" role="tablist" aria-label="Chat mode">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          role="tab"
          title={mode.hint}
          disabled={disabled}
          aria-selected={value === mode.value}
          className={"chat-mode" + (value === mode.value ? " active" : "")}
          onClick={() => onChange(mode.value)}
        >
          {mode.value === "ask" ? (
            <MessageCircleQuestion size={12} />
          ) : (
            <Wand2 size={12} />
          )}
          <span>{mode.label}</span>
        </button>
      ))}
    </div>
  );
}
