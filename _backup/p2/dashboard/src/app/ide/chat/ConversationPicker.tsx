import { ChevronDown, MessagesSquare } from "lucide-react";
import type { ConversationSummary } from "@/shared/types/agent";

export function ConversationPicker({
  conversations,
  activeId,
  disabled,
  onSelect,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  disabled: boolean;
  onSelect: (conversationId: string) => void;
}) {
  const active = conversations.find((entry) => entry.id === activeId);
  const label = active ? active.title : "New conversation";

  return (
    <div
      className={"chat-conversation" + (disabled ? " disabled" : "")}
      title={`${label} — click to switch conversation`}
    >
      <MessagesSquare size={12} className="chat-conversation-icon" />
      <span className="chat-conversation-label">{label}</span>
      <ChevronDown size={13} className="chat-conversation-caret" />

      <select
        className="chat-conversation-select"
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
            {conversation.title} · {conversation.messageCount} msg
          </option>
        ))}
      </select>
    </div>
  );
}
