import type { CreateSessionBody, FinishSessionBody, SessionItem } from '@knee/shared';
import { ApiHttpError, UnauthorizedError, type Api } from '../api';

/**
 * Card 3.4 — fila de gravação da sessão.
 *
 * Ordem garantida: cria a sessão → grava cada série → finaliza. As séries que chegam antes
 * de a sessão existir esperam na fila. Falha de rede ou do servidor (5xx, 429) é repetida
 * com espera crescente, sem limite: a internet da academia oscila e o treino não pode travar
 * nem perder dados por isso. Erro definitivo (4xx) para a fila e é mostrado na tela.
 *
 * Limitação: a fila vive na memória da aba. Fechar o app no meio perde o que ainda não subiu.
 */
export type SyncStatus = 'idle' | 'saving' | 'retrying' | 'saved' | 'failed';

export interface SyncState {
  status: SyncStatus;
  pending: number;
  sessionId: string | null;
  error: string | null;
}

type Op =
  | { kind: 'create'; body: CreateSessionBody }
  | { kind: 'item'; item: SessionItem }
  | { kind: 'finish'; body: FinishSessionBody };

type SessionApi = Pick<Api, 'createSession' | 'addSessionItem' | 'finishSession'>;

const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

export class SessionSync {
  private readonly queue: Op[] = [];
  private pumping = false;
  private sessionId: string | null = null;
  private finished = false;
  private state: SyncState = { status: 'idle', pending: 0, sessionId: null, error: null };

  constructor(
    private readonly api: SessionApi,
    private readonly onChange: (state: SyncState) => void,
    private readonly wait: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
  ) {}

  start(body: CreateSessionBody): void {
    this.enqueue({ kind: 'create', body });
  }

  addItem(item: SessionItem): void {
    this.enqueue({ kind: 'item', item });
  }

  finish(body: FinishSessionBody): void {
    this.enqueue({ kind: 'finish', body });
  }

  get snapshot(): SyncState {
    return this.state;
  }

  private enqueue(op: Op): void {
    if (this.state.status === 'failed') return;
    this.queue.push(op);
    this.update({ pending: this.queue.length });
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.queue.length > 0 && this.state.status !== 'failed') {
        const op = this.queue[0]!;
        this.update({ status: 'saving' });
        const ok = await this.runWithRetry(op);
        if (!ok) return;
        this.queue.shift();
        this.update({ pending: this.queue.length });
      }
      if (this.state.status !== 'failed') {
        this.update({ status: this.finished ? 'saved' : 'idle' });
      }
    } finally {
      this.pumping = false;
    }
  }

  /** true = concluída; false = erro definitivo (fila parada). */
  private async runWithRetry(op: Op): Promise<boolean> {
    for (let attempt = 0; ; attempt++) {
      try {
        await this.run(op);
        return true;
      } catch (error) {
        if (!isRetryable(error)) {
          this.update({ status: 'failed', error: describe(error) });
          return false;
        }
        this.update({ status: 'retrying', error: describe(error) });
        const delays = this.retryDelaysMs;
        await this.wait(delays[Math.min(attempt, delays.length - 1)] ?? 1_000);
      }
    }
  }

  private async run(op: Op): Promise<void> {
    switch (op.kind) {
      case 'create': {
        const session = await this.api.createSession(op.body);
        this.sessionId = session.id;
        this.update({ sessionId: session.id });
        return;
      }
      case 'item':
        await this.api.addSessionItem(this.requireSession(), op.item);
        return;
      case 'finish':
        try {
          await this.api.finishSession(this.requireSession(), op.body);
        } catch (error) {
          // 409 = já finalizada (ex.: a primeira tentativa chegou mas a resposta se perdeu).
          if (!(error instanceof ApiHttpError && error.status === 409)) throw error;
        }
        this.finished = true;
        return;
    }
  }

  private requireSession(): string {
    if (!this.sessionId) throw new SyncOrderError();
    return this.sessionId;
  }

  private update(patch: Partial<SyncState>): void {
    const errorCleared = patch.status === 'saving' || patch.status === 'saved';
    this.state = { ...this.state, ...(errorCleared ? { error: null } : {}), ...patch };
    this.onChange(this.state);
  }
}

/** Série ou finalização sem sessão criada: erro de programação, não adianta repetir. */
class SyncOrderError extends Error {
  constructor() {
    super('Sessão ainda não criada');
    this.name = 'SyncOrderError';
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof UnauthorizedError || error instanceof SyncOrderError) return false;
  if (error instanceof ApiHttpError) return error.status >= 500 || error.status === 429;
  return true; // falha de rede (fetch lança TypeError) ou desconhecida
}

function describe(error: unknown): string {
  if (error instanceof UnauthorizedError) return 'Chave do aparelho recusada';
  if (error instanceof ApiHttpError) return error.message;
  return 'Sem conexão com o servidor';
}
