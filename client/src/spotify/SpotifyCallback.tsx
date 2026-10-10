import { useEffect, useState } from 'react';
import { createSpotifyAuth } from './useSpotify';

// O código do Spotify é de uso único: em modo estrito o React roda o efeito duas vezes,
// então a troca é feita uma vez só por carregamento da página.
let exchange: Promise<void> | null = null;

type CallbackState = { status: 'working' | 'ok' | 'error'; message?: string };

/** Rota /spotify/callback: conclui o login e volta para o treino. */
export function SpotifyCallback({ onDone }: { onDone: () => void }) {
  const [auth] = useState(() => createSpotifyAuth());
  const [state, setState] = useState<CallbackState>(() =>
    auth
      ? { status: 'working' }
      : { status: 'error', message: 'Spotify não configurado neste app.' },
  );

  useEffect(() => {
    if (!auth) return;
    exchange ??= auth.completeLogin(window.location.search);
    exchange
      .then(() => setState({ status: 'ok' }))
      .catch((error: unknown) =>
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Falha ao conectar.',
        }),
      );
  }, [auth]);

  return (
    <div className="screen-message">
      <h1>Spotify</h1>
      <p className={state.status === 'error' ? 'key-error' : 'muted'}>
        {state.status === 'working'
          ? 'Conectando…'
          : state.status === 'ok'
            ? 'Spotify conectado.'
            : state.message}
      </p>
      {state.status !== 'working' && (
        <button className="button button--primary" onClick={onDone}>
          Voltar ao treino
        </button>
      )}
    </div>
  );
}
