// Overview / dashboard data.
//
// TODO(backend): the agent service is not wired for this screen yet. Replace
// `mockOverview()` with `fetchOverview()` once the endpoints exist:
//   - STATUS + INDEXED FILES  ->  GET /api/agent/status
//       { chunks_indexed, target_project, chroma_path, ask_model,
//         code_model, ollama_backend, files: [{ name, chunks }] }
//   - LIVE ACTIVITY           ->  a file-events stream (SSE) from the watcher
//       { kind: "modified" | "created" | "deleted", path, at }

export type OverviewStatus = {
  chunksIndexed: number;
  targetProject: string;
  chromaPath: string;
  askModel: string;
  codeModel: string;
  ollamaBackend: string;
};

export type IndexedFile = { name: string; chunks: number };

export type ActivityKind = "modified" | "created" | "deleted";
export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  path: string;
  at: number;
};

export type OverviewData = {
  status: OverviewStatus;
  files: IndexedFile[];
  activity: ActivityEvent[];
};

const MOCK_FILES: IndexedFile[] = [
  { name: "README.md", chunks: 1 },
  { name: "ioc.config.yml", chunks: 1 },
  { name: "main.py", chunks: 6 },
  { name: "notes/__init__.py", chunks: 1 },
  { name: "notes/cli.py", chunks: 3 },
  { name: "notes/service.py", chunks: 8 },
  { name: "notes/storage.py", chunks: 9 },
  { name: "tests/test_service.py", chunks: 6 },
];

/** Placeholder data so the screen can be built before the backend exists. */
export function mockOverview(root: string): OverviewData {
  return {
    status: {
      chunksIndexed: MOCK_FILES.reduce((n, f) => n + f.chunks, 0),
      targetProject: root,
      chromaPath: root.replace(/\/+$/, "") + "/.chroma",
      askModel: "qwen2.5:3b",
      codeModel: "qwen2.5-coder:3b",
      ollamaBackend: "http://127.0.0.1:11434",
    },
    files: MOCK_FILES,
    activity: [],
  };
}

/** Stub — swap the body for a real request once the endpoint lands. */
export async function fetchOverview(root: string): Promise<OverviewData> {
  return mockOverview(root);
}
