/**
 * Card 5.2 — controle de reprodução pela Web API do Spotify (exige Premium).
 * O app não toca áudio: ele comanda o Spotify aberto no celular (o "dispositivo ativo").
 * Nenhum erro daqui pode travar o treino: quem chama trata SpotifyPlaybackError como aviso.
 */
import { SPOTIFY_URI } from '@knee/shared';

const API = 'https://api.spotify.com/v1';

export type PlaybackProblem = 'no-device' | 'premium' | 'auth' | 'rate-limit' | 'unknown';

export class SpotifyPlaybackError extends Error {
  constructor(
    readonly problem: PlaybackProblem,
    message: string,
  ) {
    super(message);
    this.name = 'SpotifyPlaybackError';
  }
}

export interface NowPlaying {
  isPlaying: boolean;
  /** Playlist/álbum em execução, se houver; senão a faixa. */
  uri: string | null;
  name: string | null;
}

interface Device {
  id: string | null;
  is_active: boolean;
  is_restricted: boolean;
  type: string;
}

export class SpotifyPlayer {
  constructor(
    private readonly getToken: () => Promise<string>,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  /**
   * Toca a playlist (contextUri) ou retoma o que estava tocando.
   * Sem dispositivo ativo, tenta o celular/único aparelho listado antes de desistir.
   */
  async play(contextUri?: string | null): Promise<void> {
    const body = contextUri ? JSON.stringify({ context_uri: contextUri }) : undefined;
    try {
      await this.command('PUT', '/me/player/play', body);
    } catch (error) {
      if (!(error instanceof SpotifyPlaybackError) || error.problem !== 'no-device') throw error;
      const device = await this.pickDevice();
      if (!device) throw error;
      await this.command('PUT', `/me/player/play?device_id=${encodeURIComponent(device)}`, body);
    }
  }

  async pause(): Promise<void> {
    await this.command('PUT', '/me/player/pause');
  }

  async nowPlaying(): Promise<NowPlaying | null> {
    const res = await this.request('GET', '/me/player');
    if (res.status === 204) return null;
    const json = (await res.json()) as {
      is_playing?: boolean;
      context?: { uri?: string } | null;
      item?: { uri?: string; name?: string } | null;
    };
    // Contextos como "Músicas Curtidas" (spotify:user:…:collection) não são URIs registráveis:
    // nesse caso fica a faixa.
    const uri = [json.context?.uri, json.item?.uri].find((u) => u && SPOTIFY_URI.test(u)) ?? null;
    return { isPlaying: Boolean(json.is_playing), uri, name: json.item?.name ?? null };
  }

  private async pickDevice(): Promise<string | null> {
    const res = await this.request('GET', '/me/player/devices');
    const { devices = [] } = (await res.json()) as { devices?: Device[] };
    const usable = devices.filter((d) => d.id && !d.is_restricted);
    const chosen =
      usable.find((d) => d.is_active) ??
      usable.find((d) => d.type.toLowerCase() === 'smartphone') ??
      (usable.length === 1 ? usable[0] : undefined);
    return chosen?.id ?? null;
  }

  private async command(method: string, path: string, body?: string): Promise<void> {
    await this.request(method, path, body);
  }

  private async request(method: string, path: string, body?: string): Promise<Response> {
    const token = await this.getToken();
    const res = await this.fetchFn(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body,
    });
    if (res.ok) return res;
    throw await toPlaybackError(res);
  }
}

async function toPlaybackError(res: Response): Promise<SpotifyPlaybackError> {
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; reason?: string };
  };
  const reason = json.error?.reason ?? '';
  const message = json.error?.message ?? '';

  if (res.status === 404 || reason === 'NO_ACTIVE_DEVICE') {
    return new SpotifyPlaybackError(
      'no-device',
      'Abra o Spotify no celular e toque qualquer faixa uma vez; depois tente de novo.',
    );
  }
  if (res.status === 401) {
    return new SpotifyPlaybackError('auth', 'A conexão com o Spotify expirou. Conecte de novo.');
  }
  if (res.status === 429) {
    return new SpotifyPlaybackError('rate-limit', 'Spotify pediu uma pausa. Tente em instantes.');
  }
  if (res.status === 403) {
    return reason === 'PREMIUM_REQUIRED' || /premium/i.test(message)
      ? new SpotifyPlaybackError('premium', 'O controle do Spotify exige conta Premium.')
      : new SpotifyPlaybackError(
          'premium',
          'Spotify recusou o comando (conta Premium e usuário liberado no app são obrigatórios).',
        );
  }
  return new SpotifyPlaybackError('unknown', `Spotify respondeu ${res.status}.`);
}
