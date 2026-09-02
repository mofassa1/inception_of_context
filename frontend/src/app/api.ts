const BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export type Entry = { name: string; path: string; is_dir: boolean };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function listDir(
  path: string,
): Promise<{ path: string; entries: Entry[] }> {
  await req(`/indexer/start?body=${encodeURIComponent(path)}`);

  return req(`/api/fs/list?path=${encodeURIComponent(path)}`);
}

export async function chooseFolder(): Promise<string | null> {
  const picked = await window.ide?.pickFolder();
  if (!picked) return null;
  await listDir(picked);
  return picked;
}

export function readFile(
  path: string,
): Promise<{ path: string; content: string }> {
  return req(`/api/fs/read?path=${encodeURIComponent(path)}`);
}

export function writeFile(
  path: string,
  content: string,
): Promise<{ ok: true }> {
  return req(`/api/fs/write`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
}

export function createEntry(
  path: string,
  isDir: boolean,
): Promise<{ path: string; is_dir: boolean }> {
  return req(`/api/fs/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, is_dir: isDir }),
  });
}

export function deleteEntry(path: string): Promise<{ ok: true }> {
  return req(`/api/fs/delete?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
}

export function renameEntry(
  path: string,
  newPath: string,
): Promise<{ path: string; is_dir: boolean }> {
  return req(`/api/fs/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, new_path: newPath }),
  });
}

export function indexWorkspace(
  path: string,
): Promise<{ path: string; files_indexed: number; chunks_indexed: number }> {
  return req(`/api/agent/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
}

export async function askAgentStream(
  query: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(BASE + `/api/agent/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) onChunk(decoder.decode(value, { stream: true }));
  }
  const tail = decoder.decode();
  if (tail) onChunk(tail);
}
