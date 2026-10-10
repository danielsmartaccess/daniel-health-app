import { useCallback, useMemo } from 'react';
import { buildPlan, type Effect, type TemplateDto } from '@knee/shared';
import { createBrowserVoiceCoach } from '../voice/voiceCoach';
import { formatCountdown, formatElapsed } from './format';
import { Timeline } from './Timeline';
import { useScreenWakeLock } from './useScreenWakeLock';
import { useWorkout } from './useWorkout';
import { startAnnouncement, toPlayerView } from './view';
import type { WakeLockStatus } from './wakeLock';

const WAKE_LOCK_LABEL: Record<WakeLockStatus, string | null> = {
  on: 'Tela acesa',
  off: null,
  unsupported: 'Tela pode apagar',
  error: 'Tela pode apagar',
};

/**
 * Player do treino: barra de progresso (3.1), voz nos últimos 5 s (3.2),
 * pausar/retomar/pular/encerrar e tela acesa (3.3).
 * Ainda não grava: dor + gravação da sessão entram no card 3.4.
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
  const wakeLock = useScreenWakeLock(view.keepAwake);
  const wakeLabel = view.keepAwake ? WAKE_LOCK_LABEL[wakeLock] : null;

  // A fala precisa sair dentro do toque (exigência do iPhone para liberar a voz).
  const start = () => {
    voice.speak(startAnnouncement(state));
    send('start');
  };
  const pause = () => {
    voice.silence();
    send('pause');
  };
  const finish = () => {
    if (window.confirm('Encerrar o treino agora? A série atual conta como pulada.')) send('finish');
  };

  return (
    <main
      className={`player player--${view.status === 'paused' ? 'paused' : (view.kind ?? view.status)}`}
    >
      <header className="player__header">
        <p className="eyebrow">{template.name}</p>
        <div className="chips">
          {wakeLabel && (
            <span className={`badge${wakeLock === 'on' ? '' : ' badge--warn'}`}>{wakeLabel}</span>
          )}
          <span className="badge">Pré-visualização · não grava</span>
        </div>
      </header>

      <Timeline segments={view.segments} overall={view.overall} />

      <section className="stage" aria-live="polite">
        <p className="stage__label">{view.label}</p>
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
        {view.canResume && (
          <button className="button button--primary" onClick={() => send('resume')}>
            Retomar
          </button>
        )}
        {(view.canPause || view.canSkip) && (
          <div className="controls__row">
            {view.canPause && (
              <button className="button" onClick={pause}>
                Pausar
              </button>
            )}
            {view.canSkip && (
              <button className="button" onClick={() => send('skip')}>
                {view.kind === 'rest' ? 'Pular descanso' : 'Pular'}
              </button>
            )}
          </div>
        )}
        {view.canFinish && (
          <button className="link-button" onClick={finish}>
            Encerrar treino
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
