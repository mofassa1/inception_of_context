import { MessageSquarePlus, Sparkles, Trash2, X } from "lucide-react";
import { CHAT_MAX_WIDTH, CHAT_MIN_WIDTH } from "@/shared/constants/config";
import { useResizable } from "@/shared/hooks/useResizable";
import type { ConversationSummaryDTO } from "@/shared/types/dto";
import { ChatComposer } from "./ChatComposer";
import { ChatList } from "./ChatList";
import { ConversationPicker } from "./ConversationPicker";
import { useEffect } from "react";
import { useChat } from "./hooks/useChat";
import { useCreateConversation } from "./hooks/useCreateConversation";
import { useDeleteConversation } from "./hooks/useDeleteConversation";
import { useListConversations } from "./hooks/useListConversations";


const NO_CONVERSATIONS: ConversationSummaryDTO[] = [];

export function ChatPanel({
  root,
  conversationId,
  onConversationChange,
  open,
  onClose,
  width,
  onResize,
  onOpenFile,
}: {
  root: string;
  conversationId: string | null;
  onConversationChange: (conversationId: string | null) => void;
  open: boolean;
  onClose: () => void;
  width: number;
  onResize: (width: number) => void;
  onOpenFile: (filePath: string) => void;
}) {
  const { listConversationsOutput, isListingConversations } =
    useListConversations({ directory: root });
  const { createConversation } = useCreateConversation();
  const { deleteConversation } = useDeleteConversation();
  const conversations = listConversationsOutput?.conversations ?? NO_CONVERSATIONS;
  const chat = useChat(root, conversationId);

  async function startConversation() {
    const conversation = await createConversation({ directory: root });
    onConversationChange(conversation.id);
  }

  async function removeConversation(id: string) {
    await deleteConversation(id);
    if (id === conversationId) onConversationChange(null);
  }
  const { startResize } = useResizable({
    width,
    minWidth: CHAT_MIN_WIDTH,
    maxWidth: CHAT_MAX_WIDTH,
    edge: "leading",
    onResize,
  });

  useEffect(() => {
    if (isListingConversations || conversationId) return;

    if (conversations.length > 0) {
      onConversationChange(conversations[0].id);
      return;
    }

    startConversation().catch(() => undefined);
  }, [isListingConversations, conversations, conversationId]);

  return (
    <div
      className="relative min-h-0 shrink-0 overflow-hidden transition-[width] duration-190 ease-[cubic-bezier(0.4,0,0.2,1)] in-[.resizing]:transition-none"
      style={{ width: open ? width : 0 }}
      inert={!open}
    >
      <div className="absolute inset-y-0 right-0 flex min-h-0 flex-col border-l border-border bg-editor-bg" style={{ width }}>
        <div
          className="absolute inset-y-0 left-0 z-5 w-2 cursor-col-resize after:absolute after:inset-y-0 after:left-px after:w-px after:bg-transparent after:transition-colors after:duration-120 hover:after:bg-accent"
          onMouseDown={startResize}
        />

        <div className="flex h-[38px] flex-none items-center gap-[7px] border-b border-border pr-2 pl-3">
          <Sparkles size={14} className="flex-none text-accent" />

          <ConversationPicker
            conversations={conversations}
            activeId={conversationId}
            disabled={chat.isBusy}
            onSelect={onConversationChange}
          />

          <div className="ml-auto flex items-center gap-px">
            <button
              className="flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-fg-dim transition-[color,background-color] duration-120 hover:bg-white/7 hover:text-fg"
              title="New conversation"
              aria-label="New conversation"
              disabled={chat.isBusy}
              onClick={() => startConversation().catch(() => undefined)}
            >
              <MessageSquarePlus size={14} />
            </button>
            <button
              className="flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-fg-dim transition-[color,background-color] duration-120 hover:bg-white/7 hover:text-fg"
              title="Delete conversation"
              aria-label="Delete conversation"
              disabled={chat.isBusy || !conversationId}
              onClick={() =>
                conversationId &&
                removeConversation(conversationId).catch(() => undefined)
              }
            >
              <Trash2 size={14} />
            </button>
            <button
              className="flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-fg-dim transition-[color,background-color] duration-120 hover:bg-white/7 hover:text-fg"
              title="Close chat"
              aria-label="Close chat"
              onClick={onClose}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <ChatList
          chats={chat.chats}
          open={open}
          isStreaming={chat.isStreaming}
          onOpenFile={onOpenFile}
          root={root}
        />

        <ChatComposer
          draft={chat.draft}
          mode={chat.mode}
          isStreaming={chat.isBusy}
          onModeChange={chat.setMode}
          onDraftChange={chat.setDraft}
          onSend={chat.send}
          onStop={chat.stop}
        />
      </div>
    </div>
  );
}
