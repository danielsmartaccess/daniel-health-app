import { useState } from 'react';
import { parseSpotifyLink } from './playlist';
import type { SpotifyControls } from './useSpotify';

/** Configuração da música, mostrada antes de iniciar o treino. */
export function SpotifyPanel({ spotify }: { spotify: SpotifyControls }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!spotify.configured) {
    return <p className="hint">Spotify: aguardando a configuração do app (Client ID).</p>;
  }

  if (!spotify.connected) {
    return (
      <div className="music">
        <div className="music__row">
          <span className="music__title">Música</span>
          <button className="button button--small" onClick={() => void spotify.connect()}>
            Conectar Spotify
          </button>
        </div>
        {spotify.message && <p className="key-error">{spotify.message}</p>}
        <p className="hint">Exige Spotify Premium. O app comanda o Spotify do seu celular.</p>
      </div>
    );
  }

  const savePlaylist = () => {
    if (!draft.trim()) return;
    const uri = parseSpotifyLink(draft);
    if (!uri) {
      setError('Não reconheci esse link. No Spotify: Compartilhar → Copiar link.');
      return;
    }
    setError(null);
    setDraft('');
    spotify.setPlaylistUri(uri);
  };

  return (
    <div className="music">
      <div className="music__row">
        <span className="music__title">Spotify conectado</span>
        <button className="link-button" onClick={spotify.disconnect}>
          Desconectar
        </button>
      </div>
      {spotify.playlistUri ? (
        <div className="music__row">
          <span className="hint">Playlist do treino definida.</span>
          <button className="link-button" onClick={() => spotify.setPlaylistUri(null)}>
            Trocar
          </button>
        </div>
      ) : (
        <label className="field">
          <span>Playlist do treino (opcional): cole o link do Spotify</span>
          <input
            value={draft}
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="https://open.spotify.com/playlist/…"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={savePlaylist}
            onKeyDown={(e) => e.key === 'Enter' && savePlaylist()}
          />
        </label>
      )}
      {error && <p className="key-error">{error}</p>}
      {!spotify.playlistUri && (
        <p className="hint">Sem playlist, ao iniciar o app retoma o que estava tocando.</p>
      )}
      {spotify.message && <p className="key-error">{spotify.message}</p>}
    </div>
  );
}

/** Barra da música durante o treino. */
export function SpotifyBar({
  spotify,
  onToggle,
}: {
  spotify: SpotifyControls;
  onToggle: () => void;
}) {
  if (!spotify.configured || !spotify.connected) return null;
  return (
    <div className="music music--bar" role="group" aria-label="Música">
      <div className="music__row">
        <span className="music__title">Spotify</span>
        <button className="button button--small" onClick={onToggle}>
          {spotify.playing ? 'Pausar música' : 'Tocar música'}
        </button>
      </div>
      {spotify.message && <p className="key-error">{spotify.message}</p>}
    </div>
  );
}
