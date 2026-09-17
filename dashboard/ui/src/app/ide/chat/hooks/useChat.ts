import { useEffect, useRef, useState } from "react";
import { PATCH_LOOP_CONTEXT_CHUNKS } from "@/shared/constants/config";
import { useAsk } from "@/shared/hooks/useAsk";
import { useRunPatchLoop } from "@/shared/hooks/useRunPatchLoop";
import type { Chat, ChatMode } from "@/shared/types/chat";
import { useAddChats } from "./useAddChats";
import { useGetConversation } from "./useGetConversation";

export function useChat(root: string, conversationId: string | null) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ChatMode>("ask");
  const abortRef = useRef<AbortController | null>(null);
  const hydratedConversationRef = useRef<string | null>(null);

  const { ask, isAsking } = useAsk();
  const { runPatchLoop, isRunningPatchLoop } = useRunPatchLoop();
  const { conversation } = useGetConversation(conversationId);
  const { addChats } = useAddChats();

  const isBusy = isAsking || isRunningPatchLoop;

  function appendChat(chat: Chat) {
    setChats((current) => [...current, chat]);
  }

  function updateChat(id: string, update: Partial<Chat>) {
    setChats((current) =>
      current.map((chat) =>
        chat.id === id ? ({ ...chat, ...update } as Chat) : chat,
      ),
    );
  }

  async function sendAsk(text: string, replyId: string) {
    const controller = new AbortController();
    abortRef.current = controller;

    let answer = "";

    try {
      await ask({
        body: { query: text, conversationId },
        signal: controller.signal,
        onSources: (sources) => updateChat(replyId, { sources }),
        onToken: (chunk) => {
          answer += chunk;
          updateChat(replyId, { content: answer });
        },
      });

      if (!answer) updateChat(replyId, { content: "(no response)" });
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        updateChat(replyId, { content: answer || `⚠ ${(error as Error).message}` });
      } else if (!answer) {
        updateChat(replyId, { content: "(stopped)" });
      }
    } finally {
      abortRef.current = null;
    }
  }

  async function sendAgent(text: string, replyId: string) {
    try {
      const patchLoopOutput = await runPatchLoop({
        query: text,
        k: PATCH_LOOP_CONTEXT_CHUNKS,
        targetPath: root,
        conversationId,
      });

      updateChat(replyId, { content: patchLoopOutput.summary, patchLoopOutput });
      persistAgentChats(text, patchLoopOutput.summary);
    } catch (error) {
      updateChat(replyId, { content: `⚠ ${(error as Error).message}` });
    }
  }

  async function send(rawText: string) {
    const text = rawText.trim();
    if (!text || isBusy) return;

    const sentAt = Date.now() / 1000;
    const replyId = crypto.randomUUID();

    appendChat({
      id: crypto.randomUUID(),
      role: "user",
      kind: "text",
      content: text,
      createdAt: sentAt,
    });

    if (mode === "ask") {
      appendChat({
        id: replyId,
        role: "assistant",
        kind: "text",
        content: "",
        createdAt: sentAt,
      });
      await sendAsk(text, replyId);
    } else {
      appendChat({
        id: replyId,
        role: "assistant",
        kind: "agent",
        content: "",
        patchLoopOutput: null,
        createdAt: sentAt,
      });
      await sendAgent(text, replyId);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function persistAgentChats(question: string, answer: string) {
    if (!conversationId) return;

    addChats({
      conversationId,
      body: {
        chats: [
          { role: "user", content: question, mode: "agent" },
          { role: "assistant", content: answer, mode: "agent" },
        ],
      },
    }).catch(() => undefined);
  }

  function clear() {
    abortRef.current?.abort();
    setChats([]);
  }

  function loadChats() {
    if (!conversation || conversation.id !== conversationId) {
      hydratedConversationRef.current = null;
      setChats([]);
      return;
    }

    if (hydratedConversationRef.current === conversation.id) return;
    hydratedConversationRef.current = conversation.id;

    setChats(
      conversation.chats.map((chat, index) => ({
        id: `${conversation.id}-${index}`,
        role: chat.role,
        kind: "text",
        content: chat.content,
        sources: chat.sources ?? undefined,
        createdAt: chat.createdAt,
      })),
    );
  }

  useEffect(() => {
    loadChats();
  }, [conversation, conversationId]);

  return {
    chats,
    draft,
    setDraft,
    mode,
    setMode,
    send,
    stop,
    clear,
    isStreaming: isAsking,
    isBusy,
  };
}
