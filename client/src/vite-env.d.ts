/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TOKEN_URL?: string;
  readonly VITE_TOKEN_API_KEY?: string;
  readonly VITE_TOKEN_API_KEY_HEADER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
