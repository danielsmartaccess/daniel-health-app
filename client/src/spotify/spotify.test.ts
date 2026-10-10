import { describe, expect, it } from 'vitest';
import { SpotifyAuth, SpotifyAuthError, TOKEN_URL } from './auth';
import { base64url, challengeFor, generateVerifier } from './pkce';
import { SpotifyPlayer, SpotifyPlaybackError } from './player';
import { parseSpotifyLink } from './playlist';
import { memoryStore } from './storage';

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** fetch falso: responde na ordem e registra as chamadas. */
function fakeFetch(responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error(`chamada inesperada: ${String(url)}`);
    return next;
  }) as typeof fetch;
  return { fn, calls };
}

describe('PKCE', () => {
  it('vetor oficial da RFC 7636 (apêndice B)', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('verificador com 64 caracteres do alfabeto base64url', () => {
    const v = generateVerifier();
    expect(v).toHaveLength(64);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('base64url sem padding', () => {
    expect(base64url(new Uint8Array([251, 255]))).toBe('-_8');
  });
});

describe('SpotifyAuth', () => {
  const config = (store = memoryStore(), responses: Response[] = [], now = () => 1_000_000) => {
    const f = fakeFetch(responses);
    const auth = new SpotifyAuth({
      clientId: 'client-123',
      redirectUri: 'https://treino-joelho.vercel.app/spotify/callback',
      store,
      fetchFn: f.fn,
      now,
    });
    return { auth, store, ...f };
  };

  it('monta a URL de autorização com S256, escopos de reprodução e state', async () => {
    const { auth, store } = config();
    const url = new URL(await auth.authorizeUrl());
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe(
      'user-modify-playback-state user-read-playback-state',
    );
    expect(url.searchParams.get('state')).toBe(store.get('treino-joelho:spotify:state'));
    expect(url.searchParams.get('code_challenge')).toBe(
      await challengeFor(store.get('treino-joelho:spotify:verifier')!),
    );
  });

  it('troca o código por tokens (sem client secret) e fica conectado', async () => {
    const { auth, store, calls } = config(memoryStore(), [
      json(200, { access_token: 'A1', refresh_token: 'R1', expires_in: 3600 }),
    ]);
    await auth.authorizeUrl();
    const state = store.get('treino-joelho:spotify:state')!;
    await auth.completeLogin(`?code=abc&state=${state}`);

    expect(auth.connected).toBe(true);
    expect(calls[0]?.url).toBe(TOKEN_URL);
    const body = new URLSearchParams(String(calls[0]?.init?.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toHaveLength(64);
    expect(body.has('client_secret')).toBe(false);
    expect(store.get('treino-joelho:spotify:verifier')).toBeNull(); // uso único
  });

  it('recusa state diferente (proteção contra CSRF) e cancelamento do usuário', async () => {
    const { auth } = config();
    await auth.authorizeUrl();
    await expect(auth.completeLogin('?code=abc&state=forjado')).rejects.toBeInstanceOf(
      SpotifyAuthError,
    );
    await expect(auth.completeLogin('?error=access_denied')).rejects.toThrow('cancelada');
  });

  it('renova antes de expirar e mantém o refresh anterior se não vier outro', async () => {
    let clock = 1_000_000;
    const store = memoryStore();
    store.set(
      'treino-joelho:spotify:tokens',
      JSON.stringify({ accessToken: 'A1', refreshToken: 'R1', expiresAt: clock + 30_000 }),
    );
    const { auth, calls } = config(
      store,
      [json(200, { access_token: 'A2', expires_in: 3600 })],
      () => clock,
    );

    expect(await auth.getAccessToken()).toBe('A2'); // faltavam 30 s: renovou
    expect(new URLSearchParams(String(calls[0]?.init?.body)).get('refresh_token')).toBe('R1');
    expect(JSON.parse(store.get('treino-joelho:spotify:tokens')!).refreshToken).toBe('R1');

    clock += 10_000;
    expect(await auth.getAccessToken()).toBe('A2'); // ainda válido: sem nova chamada
    expect(calls).toHaveLength(1);
  });

  it('refresh revogado (invalid_grant): desconecta e pede novo login', async () => {
    const store = memoryStore();
    store.set(
      'treino-joelho:spotify:tokens',
      JSON.stringify({ accessToken: 'A1', refreshToken: 'R1', expiresAt: 0 }),
    );
    const { auth } = config(store, [json(400, { error: 'invalid_grant' })]);
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(SpotifyAuthError);
    expect(auth.connected).toBe(false);
  });
});

describe('SpotifyPlayer', () => {
  const token = async () => 'T';

  it('toca a playlist no dispositivo ativo', async () => {
    const f = fakeFetch([new Response(null, { status: 204 })]);
    await new SpotifyPlayer(token, f.fn).play('spotify:playlist:abc');
    expect(f.calls[0]?.url).toBe('https://api.spotify.com/v1/me/player/play');
    expect(f.calls[0]?.init?.method).toBe('PUT');
    expect(JSON.parse(String(f.calls[0]?.init?.body))).toEqual({
      context_uri: 'spotify:playlist:abc',
    });
  });

  it('sem dispositivo ativo: escolhe o celular listado e tenta de novo', async () => {
    const f = fakeFetch([
      json(404, {
        error: {
          status: 404,
          message: 'Player command failed: No active device found',
          reason: 'NO_ACTIVE_DEVICE',
        },
      }),
      json(200, {
        devices: [
          { id: 'pc', is_active: false, is_restricted: false, type: 'Computer' },
          { id: 'iphone', is_active: false, is_restricted: false, type: 'Smartphone' },
        ],
      }),
      new Response(null, { status: 204 }),
    ]);
    await new SpotifyPlayer(token, f.fn).play(null);
    expect(f.calls[2]?.url).toBe('https://api.spotify.com/v1/me/player/play?device_id=iphone');
    expect(f.calls[2]?.init?.body).toBeUndefined(); // retomar: sem corpo
  });

  it('sem nenhum dispositivo: erro claro pedindo para abrir o Spotify', async () => {
    const f = fakeFetch([
      json(404, { error: { reason: 'NO_ACTIVE_DEVICE' } }),
      json(200, { devices: [] }),
    ]);
    await expect(new SpotifyPlayer(token, f.fn).play(null)).rejects.toMatchObject({
      problem: 'no-device',
    });
  });

  it('403 vira aviso de Premium; 429 vira pedido de pausa', async () => {
    const premium = fakeFetch([
      json(403, {
        error: { message: 'Player command failed: Premium required', reason: 'PREMIUM_REQUIRED' },
      }),
    ]);
    await expect(new SpotifyPlayer(token, premium.fn).pause()).rejects.toMatchObject({
      problem: 'premium',
    });
    const rate = fakeFetch([json(429, {})]);
    await expect(new SpotifyPlayer(token, rate.fn).pause()).rejects.toBeInstanceOf(
      SpotifyPlaybackError,
    );
  });

  it('o que está tocando: playlist quando há contexto; nada quando 204', async () => {
    const f = fakeFetch([
      json(200, {
        is_playing: true,
        context: { uri: 'spotify:playlist:abc' },
        item: { uri: 'spotify:track:t1', name: 'Faixa 1' },
      }),
      new Response(null, { status: 204 }),
    ]);
    const player = new SpotifyPlayer(token, f.fn);
    expect(await player.nowPlaying()).toEqual({
      isPlaying: true,
      uri: 'spotify:playlist:abc',
      name: 'Faixa 1',
    });
    expect(await player.nowPlaying()).toBeNull();
  });

  it('"Músicas Curtidas" não é URI registrável: usa a faixa', async () => {
    const f = fakeFetch([
      json(200, {
        is_playing: true,
        context: { uri: 'spotify:user:dani:collection' },
        item: { uri: 'spotify:track:t1', name: 'Faixa 1' },
      }),
    ]);
    expect((await new SpotifyPlayer(token, f.fn).nowPlaying())?.uri).toBe('spotify:track:t1');
  });
});

describe('parseSpotifyLink', () => {
  it('aceita link de compartilhar, link com idioma e URI', () => {
    expect(
      parseSpotifyLink('https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP?si=abc'),
    ).toBe('spotify:playlist:37i9dQZF1DX76Wlfdnj7AP');
    expect(
      parseSpotifyLink(' https://open.spotify.com/intl-pt/album/4aawyAB9vmqN3uQ7FjRGTy '),
    ).toBe('spotify:album:4aawyAB9vmqN3uQ7FjRGTy');
    expect(parseSpotifyLink('spotify:playlist:37i9dQZF1DX76Wlfdnj7AP')).toBe(
      'spotify:playlist:37i9dQZF1DX76Wlfdnj7AP',
    );
  });

  it('recusa outros sites e texto solto', () => {
    expect(parseSpotifyLink('https://evil.example/playlist/abc')).toBeNull();
    expect(parseSpotifyLink('minha playlist')).toBeNull();
  });
});
