// The film installs a model from the window. For the download to show at every take,
// the model must not be there when the take starts.

const OLLAMA_URL = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

export async function isInstalled(name: string) {
  const response = await fetch(`${OLLAMA_URL}/api/tags`);
  const { models } = (await response.json()) as { models: { name: string }[] };
  return models.some((model) => model.name === name || model.name === `${name}:latest`);
}

export async function removeModel(name: string) {
  if (!(await isInstalled(name))) return false;
  const response = await fetch(`${OLLAMA_URL}/api/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: name }),
  });
  if (!response.ok) throw new Error(`could not remove ${name}: ${response.status} ${await response.text()}`);
  return true;
}
