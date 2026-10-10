/**
 * Card 3.3 — mantém a tela acesa durante o treino (Screen Wake Lock API).
 *
 * O navegador solta a trava sempre que a página fica oculta (troca de app, tela bloqueada);
 * por isso ela é pedida de novo quando a página volta a ficar visível.
 * Sem suporte (ou se o pedido falhar), o treino segue normalmente: só avisamos na tela.
 * Interfaces mínimas para testar sem navegador.
 */
export interface SentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}

export interface WakeLockApi {
  request(type: 'screen'): Promise<SentinelLike>;
}

export interface VisibilityDoc {
  visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export type WakeLockStatus = 'unsupported' | 'off' | 'on' | 'error';

export class ScreenWakeLock {
  private sentinel: SentinelLike | null = null;
  private wanted = false;

  constructor(
    private readonly api: WakeLockApi | null,
    private readonly doc: VisibilityDoc,
    private readonly onStatus: (status: WakeLockStatus) => void,
  ) {}

  async enable(): Promise<void> {
    if (!this.api) {
      this.onStatus('unsupported');
      return;
    }
    if (this.wanted) return;
    this.wanted = true;
    this.doc.addEventListener('visibilitychange', this.onVisibility);
    await this.acquire();
  }

  async disable(): Promise<void> {
    this.wanted = false;
    this.doc.removeEventListener('visibilitychange', this.onVisibility);
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel && !sentinel.released) await sentinel.release().catch(() => {});
    if (this.api) this.onStatus('off');
  }

  private onVisibility = () => {
    if (this.wanted && this.doc.visibilityState === 'visible') void this.acquire();
  };

  private async acquire(): Promise<void> {
    if (!this.api || !this.wanted) return;
    if (this.sentinel && !this.sentinel.released) return;
    if (this.doc.visibilityState !== 'visible') return;
    try {
      const sentinel = await this.api.request('screen');
      // disable() pode ter sido chamado enquanto o pedido estava pendente.
      if (!this.wanted) {
        await sentinel.release().catch(() => {});
        return;
      }
      this.sentinel = sentinel;
      sentinel.addEventListener?.('release', () => {
        if (this.sentinel === sentinel) this.onStatus('off');
      });
      this.onStatus('on');
    } catch {
      this.onStatus('error');
    }
  }
}

export function browserWakeLockApi(): WakeLockApi | null {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
    ? (navigator.wakeLock as unknown as WakeLockApi)
    : null;
}
