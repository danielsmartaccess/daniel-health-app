import { useEffect, useState } from 'react';
import { recoveryInsights, type RecoveryEvent } from '@knee/shared';
import { api, UnauthorizedError } from '../api';
import {
  factorSentence,
  formatChange,
  formatDayMonth,
  formatNumber,
  formatPain,
  kickLabel,
  kindLabel,
} from './format';
import { PainChart } from './PainChart';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; events: RecoveryEvent[] };

/** Card 4.1 — painel de recuperação. Recarrega sempre que a aba é aberta. */
export function RecoveryScreen({
  active,
  onUnauthorized,
}: {
  active: boolean;
  onUnauthorized: () => void;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    api
      .getRecovery()
      .then(({ events }) => !cancelled && setLoad({ status: 'ready', events }))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof UnauthorizedError) return onUnauthorized();
        // Mantém o que já estava na tela; só mostra erro se ainda não havia dados.
        setLoad((prev) =>
          prev.status === 'ready'
            ? prev
            : { status: 'error', message: error instanceof Error ? error.message : 'Erro' },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [active, onUnauthorized]);

  if (load.status === 'loading') return <p className="screen-message">Carregando painel…</p>;
  if (load.status === 'error') {
    return (
      <div className="screen-message">
        <p>Não foi possível carregar o painel.</p>
        <p className="muted">{load.message}</p>
      </div>
    );
  }

  const { events } = load;
  const insights = recoveryInsights(events);
  const newestFirst = [...events].reverse();

  return (
    <main className="recovery">
      <h1 className="recovery__title">Recuperação</h1>

      <section className="tiles" aria-label="Resumo">
        <div className="tile">
          <span className="tile__label">Treinos registrados</span>
          <span className="tile__value">{insights.total}</span>
        </div>
        <div className="tile">
          <span className="tile__label">Variação média da dor</span>
          <span className="tile__value">{formatChange(insights.averageChange)}</span>
          <span className="tile__note">depois − antes</span>
        </div>
        <div className="tile">
          <span className="tile__label">Sob anti-inflamatório</span>
          <span className="tile__value">
            {insights.underAntiInflammatory}
            <small> de {insights.total}</small>
          </span>
        </div>
      </section>

      {events.length === 0 ? (
        <p className="muted">Nenhum treino registrado ainda.</p>
      ) : (
        <section className="card">
          <h2 className="card__title">Dor no joelho por treino</h2>
          <PainChart events={events} />
        </section>
      )}

      <section className="card">
        <h2 className="card__title">Cruzamentos com a dor depois do treino</h2>
        <ul className="insights">
          {insights.factors.map((f) => (
            <li key={f.factor}>
              <strong>{f.label}</strong>
              <span>{factorSentence(f)}</span>
            </li>
          ))}
        </ul>
        {insights.underAntiInflammatory > 0 && (
          <p className="caveat">
            {insights.underAntiInflammatory} de {insights.total} treinos foram sob
            anti-inflamatório: a dor pode estar mascarada. Não use dor baixa nesses dias como sinal
            para voltar à pernada.
          </p>
        )}
        <p className="hint">
          Sono, peso e álcool são do mesmo dia do treino, vindos do health app. Correlação não é
          causa.
        </p>
      </section>

      {events.length > 0 && (
        <section className="card">
          <h2 className="card__title">Todos os treinos</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Dor</th>
                  <th scope="col">Anti</th>
                  <th scope="col">Sono</th>
                  <th scope="col">Peso</th>
                  <th scope="col">Álcool</th>
                </tr>
              </thead>
              <tbody>
                {newestFirst.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDayMonth(e.date)}</td>
                    <td>
                      {kindLabel(e.kind)}
                      {e.kind === 'swim' && e.distanceM ? (
                        <span className="cell-note">
                          {formatNumber(e.distanceM, ' m')}
                          {e.kick ? ` · ${kickLabel(e.kick)}` : ''}
                        </span>
                      ) : null}
                    </td>
                    <td>{formatPain(e.painBefore, e.painAfter)}</td>
                    <td>
                      {e.onAntiInflammatory === null ? '—' : e.onAntiInflammatory ? 'sim' : 'não'}
                    </td>
                    <td>{formatNumber(e.sleepHours, ' h')}</td>
                    <td>{formatNumber(e.weightKg)}</td>
                    <td>{formatNumber(e.alcoholDoses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
