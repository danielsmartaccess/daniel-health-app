/**
 * Formatos de resposta da API (contrato entre server e client).
 * As entradas são validadas pelos schemas zod em ./schemas.
 */
import type { SwimLogBody } from './schemas';
import type { TemplateItemInput } from './workout/plan';

export interface ApiError {
  error: string;
  details?: { path: string; message: string }[];
}

/** GET /api/templates/:id — itens prontos para buildPlan(). */
export interface TemplateDto {
  id: string;
  name: string;
  description: string | null;
  items: TemplateItemInput[];
}

/** POST /api/sessions */
export interface SessionStartedDto {
  id: string;
  dailyLogId: string;
  date: string;
  startedAt: string;
}

/** POST /api/sessions/:id/items */
export interface SessionItemCreatedDto {
  id: string;
}

/** PATCH /api/sessions/:id/finish */
export interface SessionFinishedDto {
  id: string;
  startedAt: string;
  endedAt: string;
}

/** POST /api/swims e GET /api/swims */
export type SwimLogDto = Required<Omit<SwimLogBody, 'startedAt' | 'endedAt'>> & {
  id: string;
  date: string;
  startedAt: string;
  endedAt: string | null;
};
