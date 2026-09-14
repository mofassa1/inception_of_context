import type { AnswerSourceDTO, ChatDTO, PatchLoopOutputDTO } from "./dto";

export type ChatMode = ChatDTO["mode"];

export type ChatRole = ChatDTO["role"];

export type TextChat = {
  id: string;
  role: ChatRole;
  kind: "text";
  content: string;
  sources?: AnswerSourceDTO[];
  createdAt: number;
};

export type AgentChat = {
  id: string;
  role: "assistant";
  kind: "agent";
  content: string;
  patchLoopOutput: PatchLoopOutputDTO | null;
  createdAt: number;
};

export type Chat = TextChat | AgentChat;
