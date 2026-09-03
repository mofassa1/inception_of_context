import { useRef, useState } from "react";
import type { ChatMessage } from "@/shared/types/chat";
import { useAskAgent } from "./useAskAgent";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const { askAgent, isPending } = useAskAgent();

  function patchMessage(id: string, text: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, text } : message,
      ),
    );
  }

  async function send(rawText: string) {
    const text = rawText.trim();
    if (!text || isPending) return;

    const sentAt = Date.now();
    const replyId = crypto.randomUUID();

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text, at: sentAt },
      { id: replyId, role: "assistant", text: "", at: sentAt + 1 },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    let answer = "";

    try {
      await askAgent({
        query: text,
        signal: controller.signal,
        onChunk: (chunk) => {
          answer += chunk;
          patchMessage(replyId, answer);
        },
      });

      if (!answer) patchMessage(replyId, "(no response)");
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        patchMessage(replyId, answer || `⚠ ${(error as Error).message}`);
      } else if (!answer) {
        patchMessage(replyId, "(stopped)");
      }
    } finally {
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function clear() {
    abortRef.current?.abort();
    setMessages([]);
  }

  return { messages, draft, setDraft, send, stop, clear, isStreaming: isPending };
}
