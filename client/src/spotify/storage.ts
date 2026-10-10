/** Armazenamento mínimo (localStorage no navegador; Map nos testes). Nunca lança. */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const browserStore: KeyValueStore = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // modo privado / armazenamento cheio: o login só não persiste
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // nada a apagar
    }
  },
};

export function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
    remove: (key) => void data.delete(key),
  };
}
