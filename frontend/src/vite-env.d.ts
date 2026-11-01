/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin to call directly (CORS). Empty means "use the Vite proxy". */
  readonly VITE_API_BASE_URL?: string
  /** Where the Vite proxy forwards /api; also used for the API docs link. */
  readonly VITE_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
