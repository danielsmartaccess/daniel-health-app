import type {
  ApiError,
  CreateSessionBody,
  FinishSessionBody,
  RecoveryDto,
  SessionFinishedDto,
  SessionItem,
  SessionItemCreatedDto,
  SessionMusicBody,
  SessionStartedDto,
  TemplateDto,
} from '@knee/shared';
import { readDeviceKey } from './deviceKey';

/** A API recusou a chave do aparelho (ausente, errada ou trocada no servidor). */
export class UnauthorizedError extends Error {
  constructor() {
    super('Chave do aparelho inválida');
    this.name = 'UnauthorizedError';
  }
}

/** Resposta HTTP de erro da API (status preservado para decidir se vale tentar de novo). */
export class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiHttpError';
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
    throw new ApiHttpError(res.status, body?.error ?? `Falha na API (${res.status})`);
  }
  return (await res.json()) as T;
}

const post = <T>(path: string, body: unknown, method = 'POST') =>
  request<T>(path, { method, body: JSON.stringify(body) });

export const api = {
  getTemplate: (id: string) => request<TemplateDto>(`/templates/${id}`),
  createSession: (body: CreateSessionBody) => post<SessionStartedDto>('/sessions', body),
  addSessionItem: (sessionId: string, item: SessionItem) =>
    post<SessionItemCreatedDto>(`/sessions/${sessionId}/items`, item),
  finishSession: (sessionId: string, body: FinishSessionBody) =>
    post<SessionFinishedDto>(`/sessions/${sessionId}/finish`, body, 'PATCH'),
  addSessionMusic: (sessionId: string, music: SessionMusicBody) =>
    post<{ id: string }>(`/sessions/${sessionId}/music`, music),
  getRecovery: () => request<RecoveryDto>('/recovery'),
};

export type Api = typeof api;
