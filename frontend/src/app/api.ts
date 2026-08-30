const BASE = "http://127.0.0.1:8000";

export type Entry = { name: string; path: string; is_dir: boolean };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function listDir(
  path: string,
): Promise<{ path: string; entries: Entry[] }> {
  return req(`/api/fs/list?path=${encodeURIComponent(path)}`);
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
