export type ListFolderInputDTO = {
  path: string;
};

export type FolderEntryDTO = {
  name: string;
  path: string;
  is_dir: boolean;
};

export type ListFolderOutputDTO = {
  path: string;
  entries: FolderEntryDTO[];
};

export type ReadFileInputDTO = {
  path: string;
};

export type ReadFileOutputDTO = {
  path: string;
  content: string;
};

export type WriteFileInputDTO = {
  path: string;
  content: string;
};

export type WriteFileOutputDTO = {
  ok: boolean;
};

export type CreateEntryInputDTO = {
  path: string;
  is_dir?: boolean;
};

export type CreateEntryOutputDTO = {
  path: string;
  is_dir: boolean;
};

export type RenameEntryInputDTO = {
  path: string;
  new_path: string;
};

export type RenameEntryOutputDTO = {
  path: string;
  is_dir: boolean;
};

export type DeleteEntryInputDTO = {
  path: string;
};

export type DeleteEntryOutputDTO = {
  ok: boolean;
};

export type SourceDTO = {
  id: string;
  file: string;
  start_line: number;
  end_line: number;
  kind: string;
  qualified_name: string;
  score: number;
  content: string;
};

export type ChatDTO = {
  role: "user" | "assistant";
  content: string;
  mode: "ask" | "agent";
  sources: SourceDTO[] | null;
  createdAt: number;
};

export type ConversationDTO = {
  id: string;
  directory: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  chats: ChatDTO[];
};

export type ListConversationsInputDTO = {
  directory: string;
};

export type ConversationSummaryDTO = {
  id: string;
  title: string;
  updatedAt: number;
  chatCount: number;
};

export type ListConversationsOutputDTO = {
  conversations: ConversationSummaryDTO[];
};

export type CreateConversationInputDTO = {
  directory: string;
};

export type NewChatDTO = {
  role: "user" | "assistant";
  content: string;
  mode: "ask" | "agent";
  sources?: SourceDTO[] | null;
};

export type AddChatsInputDTO = {
  chats: NewChatDTO[];
};

export type DeleteConversationOutputDTO = {
  ok: boolean;
};

export type IgnoreRuleDTO = {
  pattern: string;
  isIgnored: boolean;
};

export type ListIgnoreRulesOutputDTO = {
  rules: IgnoreRuleDTO[];
};

export type SetIgnoreRuleInputDTO = {
  pattern: string;
  isIgnored: boolean;
};

export type IndexedFileDTO = {
  name: string;
  chunks: number;
};

export type ChunkDTO = {
  id: string;
  content: string;
  file: string;
  kind: string;
  qualified_name: string;
  start_line: number;
  end_line: number;
  content_hash: string;
};

export type StatusOutputDTO = {
  chunks_indexed: number;
  target_project: string;
  chroma_path: string;
  ask_model: string;
  code_model: string;
  ollama_backend: string;
  embed_model: string;
  watching: boolean;
  files: IndexedFileDTO[];
};

export type FilesOutputDTO = {
  files: IndexedFileDTO[];
};

export type FileInputDTO = {
  path: string;
};

export type FileOutputDTO = {
  file: string;
  chunks: ChunkDTO[];
};

export type ChunksInputDTO = {
  offset?: number;
  limit?: number;
};

export type ChunksOutputDTO = {
  chunks: ChunkDTO[];
  offset: number;
  limit: number;
  total: number;
};

export type ContextInputDTO = {
  query: string;
  k?: number;
  conversationId?: string | null;
};

export type ContextOutputDTO = {
  sources: SourceDTO[];
};

export type PatchLoopInputDTO = {
  query: string;
  k?: number;
  targetPath?: string | null;
  conversationId?: string | null;
};

export type PatchFileDTO = {
  path: string;
  op: "create" | "modify" | "delete";
  content: string;
};

export type SanityDTO = {
  code: number;
  message: string;
};

export type PatchAttemptDTO = {
  number: number;
  summary: string;
  files: PatchFileDTO[];
  sanity: SanityDTO;
  applied: boolean;
  validation_passed: boolean;
  validation_output: string;
};

export type PatchLoopOutputDTO = {
  succeeded: boolean;
  attempts: PatchAttemptDTO[];
  rolled_back: boolean;
  files_touched: string[];
  summary: string;
};

export type IndexEventDTO = {
  id: string;
  kind: "indexed" | "modified" | "deleted" | "patched" | "error";
  path: string;
  chunk_count: number;
  at: number;
};

export type ModelChoiceDTO = {
  name: string;
  installed: boolean;
  download_gib: number | null;
  ram_gib: number | null;
};

export type ModelsOutputDTO = {
  ask_model: string;
  code_model: string;
  models: ModelChoiceDTO[];
};

export type SetModelsInputDTO = {
  ask_model?: string;
  code_model?: string;
};

export type PullModelInputDTO = {
  name: string;
};

export type PullProgressLineDTO = {
  type: "progress";
  status: string;
  completed: number;
  total: number;
};

export type PullDoneLineDTO = {
  type: "done";
  name: string;
};

export type PullErrorLineDTO = {
  type: "error";
  message: string;
};

export type AskInputDTO = {
  query: string;
  k?: number;
  conversationId?: string | null;
};

export type AskSourcesLineDTO = {
  type: "sources";
  sources: SourceDTO[];
};

export type AskTokenLineDTO = {
  type: "token";
  text: string;
};
