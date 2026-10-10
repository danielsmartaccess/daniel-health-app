import { useCallback, useMemo, useState } from 'react';
import { buildPlan, type Effect, type TemplateDto } from '@knee/shared';
import { api } from '../api';
import { PainScale } from '../session/PainScale';
import { readAntiInflammatory, saveAntiInflammatory } from '../session/preferences';
import { SessionSync, type SyncState } from '../session/sessionSync';
import { syncLabel } from '../session/syncLabel';
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
 * Player do treino guiado:
 * 3.1 barra de progresso · 3.2 voz nos últimos 5 s · 3.3 pausar/pular/encerrar + tela acesa ·
 * 3.4 dor antes/depois, anti-inflamatório e gravação de cada série na hora.
 */
export function Player({ template }: { template: TemplateDto }) {
  const plan = useMemo(() => buildPlan(template.items), [template]);
  const voice = useMemo(() => createBrowserVoiceCoach(), []);

  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    pending: 0,
    sessionId: null,
    error: null,
  });
  const [sync] = useState(() => new SessionSync(api, setSyncState));

  // Check-in (antes) e check-out (depois)
  const [painBefore, setPainBefore] = useState<number | null>(null);
  const [antiInflammatory, setAntiInflammatory] = useState(readAntiInflammatory);
  const [painAfter, setPainAfter] = useState<number | null>(null);
  const [squatNotes, setSquatNotes] = useState('');
  const [freeNotes, setFreeNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const onEffect = useCallback(
    (effect: Effect) => {
      if (effect.type === 'speak') voice.speak(effect.text);
      if (effect.type === 'item') sync.addItem(effect.item); // grava a série assim que termina
      if (effect.type === 'finished') voice.speak('Treino concluído');
    },
    [voice, sync],
  );
  const { state, now, send } = useWorkout(plan, onEffect);
  const view = toPlayerView(state, now);
  const wakeLock = useScreenWakeLock(view.keepAwake);
  const wakeLabel = view.keepAwake ? WAKE_LOCK_LABEL[wakeLock] : null;
  const saveLabel = syncLabel(syncState, state.status !== 'idle');

  const start = () => {
    if (painBefore === null) return;
    // A fala precisa sair dentro do toque (exigência do iPhone para liberar a voz).
    voice.speak(startAnnouncement(state));
    send('start');
    saveAntiInflammatory(antiInflammatory);
    sync.start({ templateId: template.id, painBefore, onAntiInflammatory: antiInflammatory });
  };
  const pause = () => {
    voice.silence();
    send('pause');
  };
  const finishEarly = () => {
    if (window.confirm('Encerrar o treino agora? A série atual conta como pulada.')) send('finish');
  };
  const submit = () => {
    if (painAfter === null) return;
    setSubmitted(true);
    sync.finish({
      painAfter,
      squatDepthNotes: squatNotes.trim() || null,
      freeNotes: freeNotes.trim() || null,
    });
  };

  const isIdle = state.status === 'idle';
  const isFinished = state.status === 'finished';
  const playerClass = state.status === 'paused' ? 'paused' : (view.kind ?? view.status);

  return (
    <main className={`player player--${playerClass}`}>
      <header className="player__header">
        <p className="eyebrow">{template.name}</p>
        <div className="chips">
          {wakeLabel && (
            <span className={`badge${wakeLock === 'on' ? '' : ' badge--warn'}`}>{wakeLabel}</span>
          )}
          {saveLabel && (
            <span className={`badge badge--${saveLabel.tone}`} role="status">
              {saveLabel.text}
            </span>
          )}
        </div>
      </header>

      <Timeline segments={view.segments} overall={view.overall} />

      {isIdle && (
        <section className="checkin">
          <h1 className="stage__title">{view.title}</h1>
          <p className="stage__subtitle">{view.subtitle}</p>
          <PainScale label="Dor no joelho agora" value={painBefore} onChange={setPainBefore} />
          <label className="toggle">
            <input
              type="checkbox"
              checked={antiInflammatory}
              onChange={(e) => setAntiInflammatory(e.target.checked)}
            />
            <span>Estou tomando anti-inflamatório</span>
          </label>
          <p className="hint">
            O anti-inflamatório mascara a dor. Marcar aqui evita que o gráfico sugira voltar ao pé
            de pato cedo demais.
          </p>
        </section>
      )}

      {isFinished && (
        <section className="checkin">
          <h1 className="stage__title">{view.title}</h1>
          {!submitted ? (
            <>
              <PainScale label="Dor no joelho agora" value={painAfter} onChange={setPainAfter} />
              <label className="field">
                <span>Agachamento: até onde desceu sem dor? (opcional)</span>
                <input
                  value={squatNotes}
                  maxLength={500}
                  onChange={(e) => setSquatNotes(e.target.value)}
                  placeholder="Ex.: 90° sem dor, pontada no fim"
                />
              </label>
              <label className="field">
                <span>Observações (opcional)</span>
                <textarea
                  value={freeNotes}
                  maxLength={2000}
                  rows={3}
                  onChange={(e) => setFreeNotes(e.target.value)}
                />
              </label>
            </>
          ) : (
            <p className="stage__subtitle">
              {syncState.status === 'saved'
                ? 'Tudo salvo. Bom trabalho.'
                : syncState.status === 'failed'
                  ? `Não foi possível salvar: ${syncState.error ?? 'erro'}.`
                  : 'Salvando… pode deixar o app aberto um instante.'}
            </p>
          )}
        </section>
      )}

      {!isIdle && !isFinished && (
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
      )}

      {view.next && !isFinished && (
        <p className="up-next">
          <span>{isIdle ? 'Primeiro' : 'A seguir'}</span> {view.next}
        </p>
      )}

      <footer className="controls">
        {view.canStart && (
          <button className="button button--primary" onClick={start} disabled={painBefore === null}>
            {painBefore === null ? 'Marque a dor para começar' : 'Iniciar treino'}
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
          <button className="link-button" onClick={finishEarly}>
            Encerrar treino
          </button>
        )}
        {isFinished && !submitted && (
          <button className="button button--primary" onClick={submit} disabled={painAfter === null}>
            {painAfter === null ? 'Marque a dor para salvar' : 'Salvar treino'}
          </button>
        )}
        {isFinished && submitted && syncState.status !== 'saving' && (
          <button className="button" onClick={() => window.location.reload()}>
            Novo treino
          </button>
        )}
      </footer>
    </main>
  );
}
