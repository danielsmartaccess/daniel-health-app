import type { ApiError, TemplateDto } from '@knee/shared';
import { readDeviceKey } from './deviceKey';

/** A API recusou a chave do aparelho (ausente, errada ou trocada no servidor). */
export class UnauthorizedError extends Error {
  constructor() {
    super('Chave do aparelho inválida');
    this.name = 'UnauthorizedError';
  }
}

/** Cliente da API. O front só conversa com /api (Express); nunca com o Supabase. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const key = readDeviceKey();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error ?? `Falha na API (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  getTemplate: (id: string) => request<TemplateDto>(`/templates/${id}`),
};
