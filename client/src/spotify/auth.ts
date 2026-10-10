import { challengeFor, generateVerifier, type RandomBytes } from './pkce';
import type { KeyValueStore } from './storage';

/**
 * Card 5.1 — login no Spotify: Authorization Code + PKCE, inteiro no navegador.
 *
 * Por que no navegador e não no Express (como o prompt previa)? Na Vercel o servidor não
 * tem disco persistente para guardar tokens, e o Spotify recomenda PKCE para apps web.
 * Os tokens ficam só neste aparelho (nunca no Supabase) e dão acesso apenas a ver e
 * controlar a reprodução (escopos abaixo).
 */
export const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
export const TOKEN_URL = 'https://accounts.spotify.com/api/token';
export const SCOPES = ['user-modify-playback-state', 'user-read-playback-state'];
export const CALLBACK_PATH = '/spotify/callback';

const KEYS = {
  verifier: 'treino-joelho:spotify:verifier',
  state: 'treino-joelho:spotify:state',
  tokens: 'treino-joelho:spotify:tokens',
};

/** Renova o token quando faltar menos que isto para expirar. */
const REFRESH_MARGIN_MS = 60_000;

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SpotifyAuthConfig {
  clientId: string;
  redirectUri: string;
  store: KeyValueStore;
  fetchFn?: typeof fetch;
  now?: () => number;
  random?: RandomBytes;
}

/** Login perdido (recusado, expirado ou revogado): é preciso conectar de novo. */
export class SpotifyAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpotifyAuthError';
  }
}

export class SpotifyAuth {
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private refreshing: Promise<string> | null = null;

  constructor(private readonly config: SpotifyAuthConfig) {
    this.fetchFn = config.fetchFn ?? ((...args) => fetch(...args));
    this.now = config.now ?? Date.now;
  }

  get connected(): boolean {
    return this.readTokens() !== null;
  }

  /** Monta a URL de autorização e guarda verificador + state para a volta. */
  async authorizeUrl(): Promise<string> {
    const verifier = generateVerifier(this.config.random);
    const state = generateVerifier(this.config.random, 32);
    this.config.store.set(KEYS.verifier, verifier);
    this.config.store.set(KEYS.state, state);
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      code_challenge_method: 'S256',
      code_challenge: await challengeFor(verifier),
      scope: SCOPES.join(' '),
      state,
    });
    return `${AUTHORIZE_URL}?${params}`;
  }

  /** Trata a volta do Spotify (query string do callback) e troca o código por tokens. */
  async completeLogin(search: string): Promise<void> {
    const params = new URLSearchParams(search);
    const expectedState = this.config.store.get(KEYS.state);
    const verifier = this.config.store.get(KEYS.verifier);
    this.config.store.remove(KEYS.state);
    this.config.store.remove(KEYS.verifier);

    const error = params.get('error');
    if (error) {
      throw new SpotifyAuthError(
        error === 'access_denied' ? 'Conexão com o Spotify cancelada' : `Spotify recusou: ${error}`,
      );
    }
    const code = params.get('code');
    if (!code || !verifier || !expectedState || params.get('state') !== expectedState) {
      throw new SpotifyAuthError(
        'Resposta do Spotify inválida ou expirada. Tente conectar de novo.',
      );
    }

    await this.requestTokens(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        code_verifier: verifier,
      }),
      null,
    );
  }

  /** Token válido, renovando antes de expirar. Renovações simultâneas viram uma só. */
  async getAccessToken(): Promise<string> {
    const tokens = this.readTokens();
    if (!tokens) throw new SpotifyAuthError('Spotify não conectado');
    if (tokens.expiresAt - this.now() > REFRESH_MARGIN_MS) return tokens.accessToken;

    this.refreshing ??= this.requestTokens(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: this.config.clientId,
      }),
      tokens.refreshToken,
    ).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  disconnect(): void {
    this.config.store.remove(KEYS.tokens);
  }

  private async requestTokens(
    body: URLSearchParams,
    previousRefresh: string | null,
  ): Promise<string> {
    const res = await this.fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!res.ok || !json.access_token) {
      // invalid_grant = refresh revogado/expirado: descartar e pedir novo login (doc do Spotify).
      if (json.error === 'invalid_grant' || res.status === 400 || res.status === 401) {
        this.disconnect();
        throw new SpotifyAuthError('A conexão com o Spotify expirou. Conecte de novo.');
      }
      throw new Error(`Falha ao falar com o Spotify (${res.status})`);
    }
    const refreshToken = json.refresh_token ?? previousRefresh;
    if (!refreshToken) throw new SpotifyAuthError('O Spotify não devolveu o token de renovação.');
    const tokens: StoredTokens = {
      accessToken: json.access_token,
      // Sem refresh_token novo na resposta, continua valendo o anterior (doc do Spotify).
      refreshToken,
      expiresAt: this.now() + (json.expires_in ?? 3600) * 1000,
    };
    this.config.store.set(KEYS.tokens, JSON.stringify(tokens));
    return tokens.accessToken;
  }

  private readTokens(): StoredTokens | null {
    const raw = this.config.store.get(KEYS.tokens);
    if (!raw) return null;
    try {
      const t = JSON.parse(raw) as StoredTokens;
      return t.accessToken && t.refreshToken && typeof t.expiresAt === 'number' ? t : null;
    } catch {
      return null;
    }
  }
}
