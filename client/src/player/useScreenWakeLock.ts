import { useEffect, useState } from 'react';
import { browserWakeLockApi, ScreenWakeLock, type WakeLockStatus } from './wakeLock';

/** Mantém a tela acesa enquanto `active` for verdadeiro. Devolve o status para a UI. */
export function useScreenWakeLock(active: boolean): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>('off');
  // Criado uma única vez; o setter de estado do React é estável.
  const [lock] = useState(() =>
    typeof document === 'undefined'
      ? null
      : new ScreenWakeLock(browserWakeLockApi(), document, setStatus),
  );

  useEffect(() => {
    if (!lock) return;
    if (active) void lock.enable();
    else void lock.disable();
  }, [active, lock]);

  useEffect(() => () => void lock?.disable(), [lock]);

  return status;
}
