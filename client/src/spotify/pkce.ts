/**
 * PKCE (RFC 7636) para o login do Spotify feito no navegador, sem client secret.
 * Alfabeto de 64 símbolos (base64url): 256 é múltiplo de 64, então não há viés no sorteio.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export type RandomBytes = (length: number) => Uint8Array;

const browserRandom: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

/** Verificador com 64 caracteres (a norma pede entre 43 e 128). */
export function generateVerifier(random: RandomBytes = browserRandom, length = 64): string {
  return Array.from(random(length), (byte) => ALPHABET[byte % 64]).join('');
}

export function base64url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** code_challenge = BASE64URL(SHA-256(verifier)), método S256. */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}
