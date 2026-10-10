import { useCallback, useMemo } from 'react';
import { buildPlan, type Effect, type TemplateDto } from '@knee/shared';
import { createBrowserVoiceCoach } from '../voice/voiceCoach';
import { formatCountdown, formatElapsed } from './format';
import { Timeline } from './Timeline';
import { useWorkout } from './useWorkout';
import { startAnnouncement, toPlayerView } from './view';

/**
 * Player do treino: barra de progresso (3.1) e voz nos últimos 5 s (3.2).
 * Ainda não grava: pausa/pular/Wake Lock (3.3) e dor + gravação da sessão (3.4) vêm depois.
 */
export function Player({ template }: { template: TemplateDto }) {
  const plan = useMemo(() => buildPlan(template.items), [template]);
  const voice = useMemo(() => createBrowserVoiceCoach(), []);

  // Efeito `speak` vem da máquina (uma vez por bloco, nos últimos 5 s). Gravação: card 3.4.
  const onEffect = useCallback(
    (effect: Effect) => {
      if (effect.type === 'speak') voice.speak(effect.text);
      if (effect.type === 'finished') voice.speak('Treino concluído');
    },
    [voice],
  );
  const { state, now, send } = useWorkout(plan, onEffect);
  const view = toPlayerView(state, now);

  // A fala precisa sair dentro do toque (exigência do iPhone para liberar a voz).
  const start = () => {
    voice.speak(startAnnouncement(state));
    send('start');
  };

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
          <button className="button button--primary" onClick={start}>
            Iniciar treino
          </button>
        )}
        {view.canStart && !voice.available && (
          <p className="muted voice-note">
            Este navegador não tem voz: os avisos serão só na tela.
          </p>
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
