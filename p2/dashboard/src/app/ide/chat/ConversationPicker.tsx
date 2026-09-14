import { ChevronDown, MessagesSquare } from "lucide-react";
import type { ConversationSummaryDTO } from "@/shared/types/dto";

export function ConversationPicker({
  conversations,
  activeId,
  disabled,
  onSelect,
}: {
  conversations: ConversationSummaryDTO[];
  activeId: string | null;
  disabled: boolean;
  onSelect: (conversationId: string) => void;
}) {
  const active = conversations.find((entry) => entry.id === activeId);
  const label = active ? active.title : "New conversation";

  return (
    <div
      className={
        "group relative flex min-w-0 flex-1 cursor-pointer items-center gap-[5px] rounded-md border border-focus bg-input-bg px-1.5 py-[3px] text-[12px] font-medium text-fg-strong transition-[border-color,background-color] duration-120 " +
        (disabled ? "cursor-default opacity-55" : "hover:border-accent hover:bg-list-hover")
      }
      title={`${label} — click to switch conversation`}
    >
      <MessagesSquare size={12} className="flex-none text-fg-dim" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronDown
        size={13}
        className={"flex-none text-fg-dim" + (disabled ? "" : " group-hover:text-accent")}
      />

      <select
        className="absolute inset-0 size-full cursor-pointer border-none opacity-0 [font:inherit] disabled:cursor-default"
        value={activeId ?? ""}
        disabled={disabled}
        aria-label="Switch conversation"
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="" disabled>
          {conversations.length ? "Switch conversation…" : "New conversation"}
        </option>
        {conversations.map((conversation) => (
          <option key={conversation.id} value={conversation.id}>
            {conversation.title} · {conversation.chatCount} chats
          </option>
        ))}
      </select>
    </div>
  );
}
