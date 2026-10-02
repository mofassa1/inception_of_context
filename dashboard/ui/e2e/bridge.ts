// The few calls the film makes to the bridge outside of the window: wait for the index,
// start from no conversation, put the models back, and read the numbers of the closing card.

const BRIDGE_URL = "http://127.0.0.1:8001";
const POLL_MS = 500;

type Status = {
  chunks_indexed: number;
  watching: boolean;
  ask_model: string;
  code_model: string;
  embed_model: string;
  files: { name: string; chunks: number }[];
};

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(BRIDGE_URL + path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

export function getStatus() {
  return call<Status>("GET", "/status");
}

// The AI agent answers /status while it still indexes; the watcher starts once the index is done.
export async function waitUntilIndexed(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = await getStatus();
      if (status.watching) return status;
    } catch {
      // The bridge or the AI agent is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`the index was not ready after ${timeoutMs / 1000} s`);
}

export async function deleteConversations(directory: string) {
  const { conversations } = await call<{ conversations: { id: string }[] }>(
    "GET",
    `/conversations?directory=${encodeURIComponent(directory)}`,
  );
  for (const conversation of conversations) {
    await call("DELETE", `/conversations/${conversation.id}`);
  }
  return conversations.length;
}

// The film switches the Ask model on camera; this puts the models of models.mk back if it stops halfway.
export function setModels(askModel: string, codeModel: string) {
  return call("PUT", "/models", { ask_model: askModel, code_model: codeModel });
}
