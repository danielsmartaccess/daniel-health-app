import type { ApiError, TemplateDto } from '@knee/shared';

/** Cliente da API. O front só conversa com /api (Express); nunca com o Supabase. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error ?? `Falha na API (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  getTemplate: (id: string) => request<TemplateDto>(`/templates/${id}`),
};
