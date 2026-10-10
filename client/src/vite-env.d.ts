/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Client ID do app no Spotify Developer Dashboard (público por natureza no fluxo PKCE). */
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
