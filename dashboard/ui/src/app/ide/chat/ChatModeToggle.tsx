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
    <div className="flex flex-none gap-px rounded-md bg-chrome-bg p-px" role="tablist" aria-label="Chat mode">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          role="tab"
          title={mode.hint}
          disabled={disabled}
          aria-selected={value === mode.value}
          className={
            "inline-flex cursor-pointer items-center gap-1 rounded-[5px] border-none px-2 py-0.5 [font:inherit] text-[10.5px] transition-[color,background-color] duration-120 disabled:cursor-default disabled:opacity-50 " +
            (value === mode.value ? "bg-accent text-white" : "bg-transparent text-fg-dim enabled:hover:text-fg")
          }
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
