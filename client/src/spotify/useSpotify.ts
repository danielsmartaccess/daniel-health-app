import { useCallback, useMemo, useState } from 'react';
import { CALLBACK_PATH, SpotifyAuth, SpotifyAuthError } from './auth';
import { SpotifyPlaybackError, SpotifyPlayer, type NowPlaying } from './player';
import { browserStore } from './storage';

const PLAYLIST_KEY = 'treino-joelho:spotify:playlist';

/** Client ID público do app do Spotify, definido no build (VITE_SPOTIFY_CLIENT_ID). */
export const SPOTIFY_CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '').trim();

export function spotifyRedirectUri(): string {
  return `${window.location.origin}${CALLBACK_PATH}`;
}

/** Instância única de autenticação (também usada pela rota de callback). */
export function createSpotifyAuth(): SpotifyAuth | null {
  if (!SPOTIFY_CLIENT_ID) return null;
  return new SpotifyAuth({
    clientId: SPOTIFY_CLIENT_ID,
    redirectUri: spotifyRedirectUri(),
    store: browserStore,
  });
}

export interface SpotifyControls {
  configured: boolean;
  connected: boolean;
  playing: boolean;
  message: string | null;
  playlistUri: string | null;
  setPlaylistUri: (uri: string | null) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Toca a playlist (ou retoma). Devolve o que ficou tocando, para registrar na sessão. */
  play: (fromPlaylist: boolean) => Promise<NowPlaying | null>;
  pause: () => Promise<void>;
}

/**
 * Estado e comandos do Spotify para a tela. Erros viram mensagem na tela e nunca são
 * lançados: o treino roda sem música se o Spotify falhar.
 */
export function useSpotify(): SpotifyControls {
  const auth = useMemo(() => createSpotifyAuth(), []);
  const player = useMemo(
    () => (auth ? new SpotifyPlayer(() => auth.getAccessToken()) : null),
    [auth],
  );
  const [connected, setConnected] = useState(() => auth?.connected ?? false);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [playlistUri, setPlaylistState] = useState<string | null>(() =>
    browserStore.get(PLAYLIST_KEY),
  );

  const setPlaylistUri = useCallback((uri: string | null) => {
    if (uri) browserStore.set(PLAYLIST_KEY, uri);
    else browserStore.remove(PLAYLIST_KEY);
    setPlaylistState(uri);
  }, []);

  const handle = useCallback(
    (error: unknown) => {
      if (
        error instanceof SpotifyAuthError ||
        (error instanceof SpotifyPlaybackError && error.problem === 'auth')
      ) {
        auth?.disconnect();
        setConnected(false);
      }
      setMessage(
        error instanceof Error
          ? error.message
          : 'O Spotify não respondeu. O treino segue sem música.',
      );
    },
    [auth],
  );

  const connect = useCallback(async () => {
    if (!auth) return;
    window.location.assign(await auth.authorizeUrl());
  }, [auth]);

  const disconnect = useCallback(() => {
    auth?.disconnect();
    setConnected(false);
    setPlaying(false);
    setMessage(null);
  }, [auth]);

  const play = useCallback(
    async (fromPlaylist: boolean) => {
      if (!player || !connected) return null;
      try {
        await player.play(fromPlaylist ? playlistUri : null);
        setPlaying(true);
        setMessage(null);
        return await player.nowPlaying().catch(() => null);
      } catch (error) {
        handle(error);
        return null;
      }
    },
    [player, connected, playlistUri, handle],
  );

  const pause = useCallback(async () => {
    if (!player || !connected) return;
    try {
      await player.pause();
      setPlaying(false);
    } catch (error) {
      handle(error);
    }
  }, [player, connected, handle]);

  return {
    configured: auth !== null,
    connected,
    playing,
    message,
    playlistUri,
    setPlaylistUri,
    connect,
    disconnect,
    play,
    pause,
  };
}
