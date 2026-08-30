interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_AGENT_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
