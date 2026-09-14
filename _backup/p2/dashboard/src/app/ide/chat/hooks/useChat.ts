import { useEffect, useRef, useState } from "react";
import type { AnswerSource } from "@/shared/types/agent";
import { isChangeRequest } from "@/shared/lib/isChangeRequest";
import type { ChatMessage, ChatMode, PatchStatus } from "@/shared/types/chat";
import { useAskAgent } from "./useAskAgent";
import { useConversation } from "./useConversation";
import { useProposePatch } from "./useProposePatch";

export function useChat(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ChatMode>("ask");
  const abortRef = useRef<AbortController | null>(null);
  const hydratedConversationRef = useRef<string | null>(null);

  const { askAgent, isPending: asking } = useAskAgent();
  const { proposePatch, isPending: proposing } = useProposePatch();
  const { conversation, appendTurns } = useConversation(conversationId);

  const isBusy = asking || proposing;

  function appendMessage(message: ChatMessage) {
    setMessages((current) => [...current, message]);
  }

  function patchMessage(id: string, update: Partial<ChatMessage>) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? ({ ...message, ...update } as ChatMessage) : message,
      ),
    );
  }

  async function sendAsk(text: string, replyId: string) {
    const controller = new AbortController();
    abortRef.current = controller;

    let answer = "";
    let answerSources: AnswerSource[] = [];

    try {
      await askAgent({
        query: text,
        conversationId,
        signal: controller.signal,
        onSources: (sources) => {
          answerSources = sources;
          patchMessage(replyId, { sources });
        },
        onToken: (chunk) => {
          answer += chunk;
          patchMessage(replyId, { text: answer });
        },
      });

      if (!answer) patchMessage(replyId, { text: "(no response)" });
      else persistTurns(text, answer, "ask", answerSources);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        patchMessage(replyId, { text: answer || `⚠ ${(error as Error).message}` });
      } else if (!answer) {
        patchMessage(replyId, { text: "(stopped)" });
      }
    } finally {
      abortRef.current = null;
    }
  }

  async function sendAgent(text: string, replyId: string) {
    try {
      const proposal = await proposePatch({ query: text, conversationId });

      if (proposal.files.length === 0) {
        patchMessage(replyId, { kind: "text", text: "", handedOff: true });
        await sendAsk(text, replyId);
        return;
      }

      patchMessage(replyId, { text: proposal.summary, proposal });
      persistTurns(text, proposal.summary, "agent");
    } catch (error) {
      patchMessage(replyId, { text: `⚠ ${(error as Error).message}` });
    }
  }

  async function send(rawText: string) {
    const text = rawText.trim();
    if (!text || isBusy) return;

    const sentAt = Date.now();
    const replyId = crypto.randomUUID();

    appendMessage({
      id: crypto.randomUUID(),
      role: "user",
      kind: "text",
      text,
      at: sentAt,
    });

    if (mode === "ask" && !isChangeRequest(text)) {
      appendMessage({
        id: replyId,
        role: "assistant",
        kind: "text",
        text: "",
        at: sentAt + 1,
      });
      await sendAsk(text, replyId);
    } else {
      appendMessage({
        id: replyId,
        role: "assistant",
        kind: "patch",
        text: "",
        proposal: null,
        routedFromAsk: mode === "ask",
        at: sentAt + 1,
      });
      await sendAgent(text, replyId);
    }
  }

  function setPatchStatus(messageId: string, status: PatchStatus) {
    patchMessage(messageId, { status });
  }

  function stop() {
    abortRef.current?.abort();
  }

  function persistTurns(
    question: string,
    answer: string,
    turnMode: ChatMode,
    sources?: AnswerSource[],
  ) {
    if (!conversationId) return;

    appendTurns({
      conversationId,
      turns: [
        { role: "user", content: question, mode: turnMode },
        { role: "assistant", content: answer, mode: turnMode, sources },
      ],
    }).catch(() => undefined);
  }

  function clear() {
    abortRef.current?.abort();
    setMessages([]);
  }

  function hydrateMessages() {
    if (!conversation) {
      hydratedConversationRef.current = null;
      setMessages([]);
      return;
    }

    if (hydratedConversationRef.current === conversation.id) return;
    hydratedConversationRef.current = conversation.id;

    setMessages(
      conversation.turns.map((turn, index) => ({
        id: `${conversation.id}-${index}`,
        role: turn.role === "assistant" ? "assistant" : "user",
        kind: "text",
        text: turn.content,
        sources: turn.sources ?? undefined,
        at: turn.at,
      })),
    );
  }

  useEffect(() => {
    hydrateMessages();
  }, [conversation]);

  return {
    messages,
    draft,
    setDraft,
    mode,
    setMode,
    send,
    setPatchStatus,
    stop,
    clear,
    isStreaming: asking,
    isBusy,
  };
}
