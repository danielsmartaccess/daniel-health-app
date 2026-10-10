import { describe, expect, it } from 'vitest';
import {
  ScreenWakeLock,
  type SentinelLike,
  type VisibilityDoc,
  type WakeLockApi,
  type WakeLockStatus,
} from './wakeLock';

function setup({ fail = false } = {}) {
  const sentinels: (SentinelLike & { fireRelease: () => void })[] = [];
  let requests = 0;
  const api: WakeLockApi = {
    request: async () => {
      requests++;
      if (fail) throw new Error('NotAllowedError');
      const listeners: (() => void)[] = [];
      const sentinel = {
        released: false,
        release: async () => {
          sentinel.released = true;
          listeners.forEach((l) => l());
        },
        addEventListener: (_t: 'release', l: () => void) => listeners.push(l),
        fireRelease: () => {
          sentinel.released = true;
          listeners.forEach((l) => l());
        },
      };
      sentinels.push(sentinel);
      return sentinel;
    },
  };
  let visibilityListener: (() => void) | null = null;
  const doc: VisibilityDoc & { setVisible: (v: boolean) => void } = {
    visibilityState: 'visible',
    addEventListener: (_t, l) => {
      visibilityListener = l;
    },
    removeEventListener: () => {
      visibilityListener = null;
    },
    setVisible: (visible) => {
      doc.visibilityState = visible ? 'visible' : 'hidden';
      visibilityListener?.();
    },
  };
  const statuses: WakeLockStatus[] = [];
  const lock = new ScreenWakeLock(api, doc, (s) => statuses.push(s));
  return { lock, doc, sentinels, statuses, requests: () => requests };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ScreenWakeLock', () => {
  it('liga ao ativar e solta ao desativar', async () => {
    const t = setup();
    await t.lock.enable();
    expect(t.statuses).toEqual(['on']);
    await t.lock.disable();
    expect(t.sentinels[0]?.released).toBe(true);
    expect(t.statuses.at(-1)).toBe('off');
  });

  it('pede de novo quando a página volta a ficar visível (o navegador solta ao ocultar)', async () => {
    const t = setup();
    await t.lock.enable();
    t.doc.setVisible(false);
    t.sentinels[0]!.fireRelease();
    expect(t.statuses.at(-1)).toBe('off');

    t.doc.setVisible(true);
    await flush();
    expect(t.requests()).toBe(2);
    expect(t.statuses.at(-1)).toBe('on');
  });

  it('não pede duas vezes nem depois de desativado', async () => {
    const t = setup();
    await t.lock.enable();
    await t.lock.enable();
    expect(t.requests()).toBe(1);
    await t.lock.disable();
    t.doc.setVisible(true);
    await flush();
    expect(t.requests()).toBe(1);
  });

  it('sem suporte: avisa e não quebra', async () => {
    const statuses: WakeLockStatus[] = [];
    const lock = new ScreenWakeLock(null, setup().doc, (s) => statuses.push(s));
    await lock.enable();
    await lock.disable();
    expect(statuses).toEqual(['unsupported']);
  });

  it('pedido recusado (ex.: modo economia de energia): status de erro, sem exceção', async () => {
    const t = setup({ fail: true });
    await expect(t.lock.enable()).resolves.toBeUndefined();
    expect(t.statuses).toEqual(['error']);
  });
});
