export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  at: number;
};

export type IndexResult = {
  path: string;
  files_indexed: number;
  chunks_indexed: number;
};
