import { randomUUID } from 'node:crypto';
import type {
  FinishSessionBody,
  RecoveryEvent,
  SessionItem,
  SessionMusicBody,
  SwimLogBody,
  SwimLogDto,
  TemplateDto,
} from '@knee/shared';
import { badRequest, conflict, notFound } from '../errors';
import type { KneeRepository } from '../repository';

interface StoredSession {
  id: string;
  dailyLogId: string;
  startedAt: string;
  endedAt: string | null;
  items: SessionItem[];
}

/** Repositório em memória com as mesmas regras do Supabase (para testes de rota). */
export class MemoryKneeRepository implements KneeRepository {
  readonly dailyLogs = new Map<string, string>(); // `${owner}|${date}` → id
  readonly sessions = new Map<string, StoredSession>();
  readonly swims: SwimLogDto[] = [];

  constructor(private readonly templates: TemplateDto[]) {}

  async getTemplate(id: string) {
    return this.templates.find((t) => t.id === id) ?? null;
  }

  async getOrCreateDailyLog(ownerId: string, date: string) {
    const key = `${ownerId}|${date}`;
    let id = this.dailyLogs.get(key);
    if (!id) {
      id = randomUUID();
      this.dailyLogs.set(key, id);
    }
    return id;
  }

  async createSession(input: { dailyLogId: string; startedAt: string }) {
    const id = randomUUID();
    this.sessions.set(id, {
      id,
      dailyLogId: input.dailyLogId,
      startedAt: input.startedAt,
      endedAt: null,
      items: [],
    });
    return { id, startedAt: input.startedAt };
  }

  async addSessionItem(sessionId: string, item: SessionItem) {
    const session = this.openSession(sessionId);
    const known = this.templates.some((t) => t.items.some((i) => i.exerciseId === item.exerciseId));
    if (!known) throw badRequest('Exercício inexistente');
    session.items.push(item);
    return { id: randomUUID() };
  }

  async finishSession(sessionId: string, _body: FinishSessionBody, endedAt: string) {
    const session = this.openSession(sessionId);
    session.endedAt = endedAt;
    return { id: session.id, startedAt: session.startedAt, endedAt };
  }

  async createSwim(_dailyLogId: string, date: string, body: SwimLogBody) {
    const swim: SwimLogDto = {
      id: randomUUID(),
      date,
      startedAt: body.startedAt,
      endedAt: body.endedAt ?? null,
      durationSeconds: body.durationSeconds,
      distanceM: body.distanceM,
      poolLengthM: body.poolLengthM ?? null,
      laps: body.laps ?? null,
      activeKcal: body.activeKcal ?? null,
      totalKcal: body.totalKcal ?? null,
      avgHr: body.avgHr ?? null,
      effort: body.effort ?? null,
      stroke: body.stroke ?? null,
      kick: body.kick,
      painBefore: body.painBefore ?? null,
      painAfter: body.painAfter ?? null,
      onAntiInflammatory: body.onAntiInflammatory ?? null,
      notes: body.notes ?? null,
    };
    this.swims.push(swim);
    return swim;
  }

  readonly music: { sessionId: string; music: SessionMusicBody; startedAt: string }[] = [];

  async addSessionMusic(sessionId: string, music: SessionMusicBody, startedAt: string) {
    if (!this.sessions.has(sessionId)) throw notFound('Sessão');
    this.music.push({ sessionId, music, startedAt });
    return { id: randomUUID() };
  }

  /** Eventos do painel definidos pelo teste. */
  recovery: RecoveryEvent[] = [];

  async listRecovery() {
    return [...this.recovery].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  async listSwims(limit: number) {
    return [...this.swims].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit);
  }

  private openSession(id: string): StoredSession {
    const session = this.sessions.get(id);
    if (!session) throw notFound('Sessão');
    if (session.endedAt) throw conflict('Sessão já finalizada');
    return session;
  }
}
