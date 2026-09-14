export const API_BASE_URL =
  import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8001";

type QueryParams = Record<string, string | number | boolean | undefined>;

export type RequestOptions = {
  params?: QueryParams;
  signal?: AbortSignal;
};

function buildUrl(endpoint: string, params?: QueryParams): string {
  const url = new URL(API_BASE_URL + endpoint);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function sendRequest(
  method: string,
  endpoint: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<Response> {
  const hasBody = body !== undefined;

  const response = await fetch(buildUrl(endpoint, options.params), {
    method,
    signal: options.signal,
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.detail ?? `${response.status} ${response.statusText}`,
    );
  }

  return response;
}

async function request<TResponse>(
  method: string,
  endpoint: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<TResponse> {
  const response = await sendRequest(method, endpoint, body, options);
  return response.json() as Promise<TResponse>;
}

export const api = {
  get: <TResponse>(endpoint: string, options?: RequestOptions) =>
    request<TResponse>("GET", endpoint, undefined, options),

  post: <TResponse>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>("POST", endpoint, body, options),

  put: <TResponse>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>("PUT", endpoint, body, options),

  patch: <TResponse>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<TResponse>("PATCH", endpoint, body, options),

  delete: <TResponse>(endpoint: string, options?: RequestOptions) =>
    request<TResponse>("DELETE", endpoint, undefined, options),

  stream: (endpoint: string, body?: unknown, options?: RequestOptions) =>
    sendRequest("POST", endpoint, body, options),
};
