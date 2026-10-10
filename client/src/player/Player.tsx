import { useCallback, useMemo } from 'react';
import { buildPlan, type Effect, type TemplateDto } from '@knee/shared';
import { formatCountdown, formatElapsed } from './format';
import { Timeline } from './Timeline';
import { useWorkout } from './useWorkout';
import { toPlayerView } from './view';

/**
 * Card 3.1 — player com barra de progresso.
 * Ainda não grava nada nem fala: voz (3.2), pausa/pular/Wake Lock (3.3) e
 * dor + gravação da sessão (3.4) entram nos próximos cards.
 */
export function Player({ template }: { template: TemplateDto }) {
  const plan = useMemo(() => buildPlan(template.items), [template]);
  // Efeitos de voz e de gravação são tratados nos cards 3.2 e 3.4.
  const onEffect = useCallback((_effect: Effect) => {}, []);
  const { state, now, send } = useWorkout(plan, onEffect);
  const view = toPlayerView(state, now);

  return (
    <main className={`player player--${view.kind ?? view.status}`}>
      <header className="player__header">
        <p className="eyebrow">{template.name}</p>
        <span className="badge">Pré-visualização · não grava</span>
      </header>

      <Timeline segments={view.segments} overall={view.overall} />

      <section className="stage" aria-live="polite">
        {/* No descanso o título já diz "Descanso": o rótulo só aparece no trabalho. */}
        <p className="stage__label">{view.kind === 'work' ? 'Agora' : ''}</p>
        <h1 className="stage__title">{view.title}</h1>
        <p className="stage__subtitle">{view.subtitle}</p>

        {view.mode === 'reps' && (
          <div className="stage__metric">
            <span className="metric__value">{view.reps ?? '—'}</span>
            <span className="metric__unit">repetições</span>
            <span className="metric__aside">{formatElapsed(view.elapsedMs)} decorridos</span>
          </div>
        )}

        {view.remainingMs !== null && (
          <div className="stage__metric">
            <span className="metric__value metric__value--clock">
              {formatCountdown(view.remainingMs)}
            </span>
            <div className="block-bar" aria-hidden="true">
              <div
                className="block-bar__fill"
                style={{ transform: `scaleX(${view.blockFraction ?? 0})` }}
              />
            </div>
          </div>
        )}
      </section>

      {view.next && (
        <p className="up-next">
          <span>A seguir</span> {view.next}
        </p>
      )}

      <footer className="controls">
        {view.canStart && (
          <button className="button button--primary" onClick={() => send('start')}>
            Iniciar treino
          </button>
        )}
        {view.canComplete && (
          <button className="button button--primary" onClick={() => send('complete')}>
            Concluí
          </button>
        )}
        {view.status === 'finished' && (
          <button className="button" onClick={() => window.location.reload()}>
            Recomeçar
          </button>
        )}
      </footer>
    </main>
  );
}
