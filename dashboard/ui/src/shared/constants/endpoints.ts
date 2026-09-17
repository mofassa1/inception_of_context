export const ENDPOINTS = {
  LIST_FOLDER: "/api/fs/list",
  READ_FILE: "/api/fs/read",
  WRITE_FILE: "/api/fs/write",
  CREATE_ENTRY: "/api/fs/create",
  RENAME_ENTRY: "/api/fs/rename",
  DELETE_ENTRY: "/api/fs/delete",

  LIST_CONVERSATIONS: "/conversations",
  CREATE_CONVERSATION: "/conversations",
  GET_CONVERSATION: "/conversations",
  ADD_CHATS: "/conversations",
  DELETE_CONVERSATION: "/conversations",

  LIST_IGNORE_RULES: "/conversations",
  SET_IGNORE_RULE: "/conversations",

  GET_STATUS: "/status",
  GET_ALL_FILES: "/files",
  GET_FILE: "/file",
  GET_CHUNKS: "/chunks",
  GET_CONTEXT: "/context",
  RUN_PATCH_LOOP: "/patch/loop",
  STREAM_EVENTS: "/events",
  ASK: "/ask",
} as const;
