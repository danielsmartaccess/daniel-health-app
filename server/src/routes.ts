import { Router } from 'express';
import {
  createSessionBodySchema,
  finishSessionBodySchema,
  idSchema,
  localDate,
  sessionItemSchema,
  swimLogBodySchema,
  type SessionFinishedDto,
  type SessionItemCreatedDto,
  type SessionStartedDto,
  type SwimLogDto,
  type TemplateDto,
} from '@knee/shared';
import { notFound, unprocessable } from './errors';
import type { KneeRepository } from './repository';

export interface ApiDeps {
  repo: KneeRepository;
  ownerId: string;
  /** Relógio injetado (ms epoch). Em produção: Date.now. */
  now: () => number;
}

/** Natação pode ser registrada depois, mas não no futuro nem muito no passado. */
const SWIM_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const SWIM_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function createApiRouter({ repo, ownerId, now }: ApiDeps): Router {
  const router = Router();

  // 2.1 — template com itens prontos para buildPlan()
  router.get('/templates/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const template = await repo.getTemplate(id);
    if (!template) throw notFound('Template');
    res.json(template satisfies TemplateDto);
  });

  // 2.2 — inicia sessão: get-or-create do dia (data local de São Paulo) + sessão
  router.post('/sessions', async (req, res) => {
    const body = createSessionBodySchema.parse(req.body);
    const template = await repo.getTemplate(body.templateId);
    if (!template) throw notFound('Template');

    const instant = now();
    const date = localDate(instant);
    const dailyLogId = await repo.getOrCreateDailyLog(ownerId, date);
    const session = await repo.createSession({
      dailyLogId,
      templateId: body.templateId,
      painBefore: body.painBefore,
      onAntiInflammatory: body.onAntiInflammatory,
      startedAt: new Date(instant).toISOString(),
    });

    const dto: SessionStartedDto = { ...session, dailyLogId, date };
    res.status(201).json(dto);
  });

  // 2.3 — grava uma série assim que ela termina
  router.post('/sessions/:id/items', async (req, res) => {
    const sessionId = idSchema.parse(req.params.id);
    const item = sessionItemSchema.parse(req.body);
    const created = await repo.addSessionItem(sessionId, item);
    res.status(201).json(created satisfies SessionItemCreatedDto);
  });

  // 2.2 — finaliza: dor depois + notas
  router.patch('/sessions/:id/finish', async (req, res) => {
    const sessionId = idSchema.parse(req.params.id);
    const body = finishSessionBodySchema.parse(req.body);
    const finished = await repo.finishSession(sessionId, body, new Date(now()).toISOString());
    res.json(finished satisfies SessionFinishedDto);
  });

  // 2.4 — natação: registro manual; o dia é a data local do início do treino
  router.post('/swims', async (req, res) => {
    const body = swimLogBodySchema.parse(req.body);
    const startedAt = Date.parse(body.startedAt);
    const current = now();
    if (startedAt > current + SWIM_FUTURE_TOLERANCE_MS) {
      throw unprocessable('O treino não pode começar no futuro');
    }
    if (startedAt < current - SWIM_MAX_AGE_MS) {
      throw unprocessable('Só é possível registrar natações dos últimos 30 dias');
    }

    const date = localDate(startedAt);
    const dailyLogId = await repo.getOrCreateDailyLog(ownerId, date);
    const swim = await repo.createSwim(dailyLogId, date, body);
    res.status(201).json(swim satisfies SwimLogDto);
  });

  router.get('/swims', async (_req, res) => {
    res.json((await repo.listSwims(100)) satisfies SwimLogDto[]);
  });

  return router;
}
