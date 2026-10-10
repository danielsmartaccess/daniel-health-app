import { SPOTIFY_URI } from '@knee/shared';

/**
 * Converte o que o usuário cola (link "Compartilhar" do app do Spotify ou URI) em URI.
 * Aceita: https://open.spotify.com/playlist/<id>?si=..., .../intl-pt/playlist/<id>,
 * spotify:playlist:<id>. Devolve null se não reconhecer.
 */
export function parseSpotifyLink(input: string): string | null {
  const text = input.trim();
  if (SPOTIFY_URI.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.hostname !== 'open.spotify.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const start = parts[0]?.startsWith('intl-') ? 1 : 0;
    const [type, id] = [parts[start], parts[start + 1]];
    const uri = `spotify:${type}:${id}`;
    return type && id && SPOTIFY_URI.test(uri) ? uri : null;
  } catch {
    return null;
  }
}
