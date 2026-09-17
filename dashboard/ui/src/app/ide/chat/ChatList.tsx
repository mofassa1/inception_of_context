import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { Markdown } from "@/shared/components/Markdown";
import { withoutCitationLine } from "@/shared/lib/withoutCitationLine";
import type { Chat } from "@/shared/types/chat";
import { ChatSources } from "./ChatSources";
import { AgentResultCard } from "./AgentResultCard";

const STICK_TO_BOTTOM_THRESHOLD_PX = 80;

export function ChatList({
  chats,
  root,
  open,
  isStreaming,
  onOpenFile,
}: {
  chats: Chat[];
  root: string;
  open: boolean;
  isStreaming: boolean;
  onOpenFile: (filePath: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  function scrollToBottom() {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    stickToBottomRef.current =
      distanceFromBottom < STICK_TO_BOTTOM_THRESHOLD_PX;
  }

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom();
  }, [chats, isStreaming]);

  useEffect(() => {
    if (open) {
      stickToBottomRef.current = true;
      scrollToBottom();
    }
  }, [open]);

  if (chats.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3.5 py-4 before:mt-auto before:content-['']" ref={scrollRef} onScroll={handleScroll}>
        <div className="my-auto flex flex-col items-center gap-2 px-[18px] py-6 text-center">
          <div className="grid size-[38px] place-items-center rounded-full bg-accent/16 text-accent">
            <Sparkles size={20} />
          </div>
          <p className="m-0 text-[13px] font-semibold text-fg-strong">Hey — how can I help?</p>
          <p className="m-0 max-w-[260px] text-[11.5px] leading-[1.55] text-fg-dim">
            I'm here to work through this project with you. Ask a question or
            describe a change, and I'll read and edit the files in this folder.
          </p>
        </div>
      </div>
    );
  }

  const lastChatId = chats[chats.length - 1]?.id;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3.5 py-4 before:mt-auto before:content-['']" ref={scrollRef} onScroll={handleScroll}>
      {chats.map((chat) => {
        if (chat.role === "user") {
          return (
            <div key={chat.id} className="flex justify-end gap-2">
              <div className="max-w-[84%] rounded-[13px_13px_3px_13px] bg-accent px-[11px] py-[7px] text-[12.5px] leading-[1.55] wrap-anywhere whitespace-pre-wrap text-white">
                {chat.content}
              </div>
            </div>
          );
        }

        const streaming = isStreaming && chat.id === lastChatId;

        return (
          <div key={chat.id} className="flex gap-2">
            <div className="mt-px grid size-[21px] flex-none place-items-center rounded-full bg-accent/18 text-accent">
              <Sparkles size={13} />
            </div>
            <div className="min-w-0 pt-0.5 text-[12.5px] leading-[1.65] wrap-anywhere whitespace-pre-wrap text-fg">
              {chat.content && <Markdown text={withoutCitationLine(chat.content)} />}
              {chat.kind === "text" && chat.sources && chat.sources.length > 0 && (
                <ChatSources
                  sources={chat.sources}
                  answer={chat.content}
                  onOpenFile={onOpenFile}
                />
              )}
              {chat.kind === "agent" && chat.patchLoopOutput && (
                <AgentResultCard
                  patchLoopOutput={chat.patchLoopOutput}
                  root={root}
                  onOpenFile={onOpenFile}
                />
              )}
              {chat.kind === "agent" && !chat.patchLoopOutput && !chat.content && (
                <span className="inline-flex gap-1 pt-1" aria-label="Thinking">
                  <i className="size-1.5 animate-chat-dot rounded-full bg-fg-dim" />
                  <i className="size-1.5 animate-chat-dot rounded-full bg-fg-dim [animation-delay:0.18s]" />
                  <i className="size-1.5 animate-chat-dot rounded-full bg-fg-dim [animation-delay:0.36s]" />
                </span>
              )}
              {streaming && !chat.content && (
                <span className="inline-flex gap-1 pt-1" aria-label="Thinking">
                  <i className="size-1.5 animate-chat-dot rounded-full bg-fg-dim" />
                  <i className="size-1.5 animate-chat-dot rounded-full bg-fg-dim [animation-delay:0.18s]" />
                  <i className="size-1.5 animate-chat-dot rounded-full bg-fg-dim [animation-delay:0.36s]" />
                </span>
              )}
              {streaming && chat.content && <span className="ml-px inline-block h-[1em] w-0.5 animate-chat-caret bg-accent align-text-bottom" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
