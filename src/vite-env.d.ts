/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AS_OF?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
