import type { AnswerSource, PatchProposal } from "./agent";

export type ChatMode = "ask" | "agent";

export type ChatRole = "user" | "assistant";

export type ChatTextMessage = {
  id: string;
  role: ChatRole;
  kind: "text";
  text: string;
  sources?: AnswerSource[];
  handedOff?: boolean;
  at: number;
};

export type ChatPatchMessage = {
  id: string;
  role: "assistant";
  kind: "patch";
  text: string;
  proposal: PatchProposal | null;
  status?: PatchStatus;
  routedFromAsk?: boolean;
  at: number;
};

export type PatchStatus = "applied" | "rejected";

export type ChatMessage = ChatTextMessage | ChatPatchMessage;
