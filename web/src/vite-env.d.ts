/// <reference types="vite/client" />

// Why: `import.meta.env` is injected by Vite at build time, but TypeScript
// doesn't know about it without this reference. Declaring the app's own
// variables gives us autocomplete and catches typos at compile time.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
