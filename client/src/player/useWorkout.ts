import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createWorkout,
  transition,
  type Block,
  type Effect,
  type WorkoutEvent,
  type WorkoutState,
} from '@knee/shared';

const TICK_MS = 200;

type EventType = WorkoutEvent['type'];

/**
 * Liga a máquina de estados pura ao relógio do navegador.
 * O tempo restante vem de timestamps, então um setInterval atrasado (aba em segundo plano,
 * tela apagada) não distorce o cronômetro: o próximo tick recupera o atraso.
 */
export function useWorkout(plan: readonly Block[], onEffect: (effect: Effect) => void) {
  const [state, setState] = useState<WorkoutState>(() => createWorkout(plan));
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);
  const onEffectRef = useRef(onEffect);

  useEffect(() => {
    onEffectRef.current = onEffect;
  }, [onEffect]);

  const send = useCallback((type: EventType) => {
    const at = Date.now();
    const result = transition(stateRef.current, { type, now: at } as WorkoutEvent);
    setNow(at);
    if (result.state !== stateRef.current) {
      stateRef.current = result.state;
      setState(result.state);
    }
    result.effects.forEach((effect) => onEffectRef.current(effect));
  }, []);

  const active = state.status === 'running' || state.status === 'resting';

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => send('tick'), TICK_MS);
    // Ao voltar para a aba, recupera o tempo na hora, sem esperar o próximo intervalo.
    const onVisible = () => {
      if (document.visibilityState === 'visible') send('tick');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, send]);

  return { state, now, send };
}
