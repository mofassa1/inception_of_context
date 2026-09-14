export type FileChunk = {
  id: string;
  content: string;
  kind: string;
  qualifiedName: string;
  startLine: number;
  endLine: number;
  contentHash: string;
};

export type FileChunks = {
  path: string;
  chunks: FileChunk[];
};

export type IndexedFile = {
  name: string;
  chunks: number;
};

export type IndexResult = {
  path: string;
  filesIndexed: number;
  chunksIndexed: number;
  totalChunks?: number;
};

export type IndexEventKind =
  | "indexed"
  | "modified"
  | "deleted"
  | "ignored"
  | "patched"
  | "error";

export type IndexEvent = {
  id: string;
  kind: IndexEventKind;
  path: string;
  chunkCount: number;
  at: number;
};

export type PatchOperation = "create" | "modify" | "delete";

export type PatchFile = {
  path: string;
  op: PatchOperation;
  content: string;
};

export type PatchProposal = {
  summary: string;
  files: PatchFile[];
  sanity: { code: number; message: string };
};

export type ApplyPatchResult = {
  applied: string[];
  reindexed: number;
  backupDir: string;
};

export type IgnoreRules = {
  ignoreNames: string[];
  ignorePaths: string[];
};

export type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
};

export type ConversationTurn = {
  role: string;
  content: string;
  mode: string;
  at: number;
  sources?: AnswerSource[] | null;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: ConversationTurn[];
};

export type FileSource = {
  path: string;
  content: string;
  lines: number;
  chunks: FileChunk[];
};

export type CollectionChunk = {
  id: string;
  file: string;
  content: string;
  kind: string;
  qualifiedName: string;
  startLine: number;
  endLine: number;
};

export type ChunkPage = {
  chunks: CollectionChunk[];
  offset: number;
  limit: number;
  total: number;
};

export type RetrievedSource = {
  file: string;
  line: number;
  kind: string;
  qualifiedName: string;
  distance: number;
};

export type RetrieveResult = {
  sources: RetrievedSource[];
};

export type PatchAttempt = {
  number: number;
  summary: string;
  files: PatchFile[];
  sanity: { code: number; message: string };
  applied: boolean;
  validationPassed: boolean;
  validationOutput: string;
};

export type PatchLoopResult = {
  succeeded: boolean;
  attempts: PatchAttempt[];
  rolledBack: boolean;
  filesTouched: string[];
  summary: string;
};

export type AnswerSource = {
  rank: number;
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  kind: string;
  qualifiedName: string;
  distance: number;
  content: string;
};

export type AskStreamLine =
  | { type: "sources"; sources: AnswerSource[] }
  | { type: "token"; text: string };
