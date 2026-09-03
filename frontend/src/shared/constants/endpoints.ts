export const ENDPOINTS = {
  INDEXER_START: "/indexer/start",
  FILES_LIST: "/api/fs/list",
  FILES_READ: "/api/fs/read",
  FILES_WRITE: "/api/fs/write",
  FILES_CREATE: "/api/fs/create",
  FILES_DELETE: "/api/fs/delete",
  FILES_RENAME: "/api/fs/rename",
  AGENT_INDEX: "/api/agent/index",
  AGENT_ASK: "/api/agent/ask",
  AGENT_STATUS: "/api/agent/status",
} as const;
