import { MessageSquare } from "lucide-react";

export function ActivityBar({
  chatOpen,
  onToggleChat,
}: {
  chatOpen: boolean;
  onToggleChat: () => void;
}) {
  return (
    <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-l border-border bg-chrome-bg pt-2">
      <button
        className={
          "flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 transition-[color,background-color] duration-120 " +
          (chatOpen ? "bg-accent text-white" : "bg-transparent text-fg-dim hover:bg-white/6 hover:text-fg")
        }
        aria-label="Toggle chat"
        aria-pressed={chatOpen}
        onClick={onToggleChat}
      >
        <MessageSquare size={20} />
      </button>
    </div>
  );
}
