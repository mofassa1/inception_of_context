import { MessageSquare } from "lucide-react";

export function ActivityBar({
  chatOpen,
  onToggleChat,
}: {
  chatOpen: boolean;
  onToggleChat: () => void;
}) {
  return (
    <div className="activitybar">
      <button
        className={"activity-btn" + (chatOpen ? " active" : "")}
        aria-label="Toggle chat"
        aria-pressed={chatOpen}
        onClick={onToggleChat}
      >
        <MessageSquare size={20} />
      </button>
    </div>
  );
}
