/**
 * Chave do aparelho: guardada só neste navegador (conveniência por aparelho).
 * Chega pelo link de configuração `…/#chave=<valor>`; o fragmento (#) nunca é enviado
 * ao servidor nem aparece em logs, e é apagado da barra de endereço logo após ser lido.
 */
const STORAGE_KEY = 'treino-joelho:device-key';
const HASH_PARAM = 'chave';

export function readDeviceKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveDeviceKey(key: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, key.trim());
    return true;
  } catch {
    return false;
  }
}

export function forgetDeviceKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // armazenamento indisponível: nada a apagar
  }
}

/** Lê a chave do link de configuração, salva e limpa o endereço. */
export function captureDeviceKeyFromUrl(): void {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const key = params.get(HASH_PARAM);
  if (!key) return;
  saveDeviceKey(key);
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
