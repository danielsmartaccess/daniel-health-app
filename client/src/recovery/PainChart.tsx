import { useState } from 'react';
import type { RecoveryEvent } from '@knee/shared';
import { formatDayMonth, formatNumber, formatPain, kickLabel, kindLabel } from './format';

/**
 * Dor antes → depois por treino (gráfico de halteres), em ordem cronológica.
 * Um tom de azul por momento (antes claro/recuado, depois forte); dor sob anti-inflamatório
 * com marcador vazado (codificação secundária, não só cor). Valores também na tabela.
 */
const BAND = 52;
const LEFT = 30;
const RIGHT = 12;
const TOP = 14;
const PLOT_H = 170;
const AXIS_H = 38;
const HEIGHT = TOP + PLOT_H + AXIS_H;
const TICKS = [0, 2, 4, 6, 8, 10];

const yOf = (pain: number) => TOP + PLOT_H - (pain / 10) * PLOT_H;

export function PainChart({ events }: { events: RecoveryEvent[] }) {
  const [active, setActive] = useState<number | null>(null);
  const width = Math.max(320, LEFT + RIGHT + events.length * BAND);
  const xOf = (i: number) => LEFT + i * BAND + BAND / 2;
  const current = active !== null ? events[active] : undefined;

  return (
    <div className="chart">
      <ul className="chart__legend" aria-label="Legenda">
        <li>
          <span className="key key--before" aria-hidden="true" /> Dor antes
        </li>
        <li>
          <span className="key key--after" aria-hidden="true" /> Dor depois
        </li>
        <li>
          <span className="key key--hollow" aria-hidden="true" /> Sob anti-inflamatório
        </li>
      </ul>

      <div className="chart__tooltip" aria-live="polite">
        {current ? (
          <>
            <strong>{formatPain(current.painBefore, current.painAfter)}</strong>
            <span>
              {formatDayMonth(current.date)} · {kindLabel(current.kind)}
              {current.kind === 'swim' && current.kick ? ` (${kickLabel(current.kick)})` : ''}
            </span>
            <span>
              {current.onAntiInflammatory ? 'Sob anti-inflamatório · ' : ''}Sono{' '}
              {formatNumber(current.sleepHours, ' h')} · Álcool {formatNumber(current.alcoholDoses)}{' '}
              · Peso {formatNumber(current.weightKg, ' kg')}
            </span>
          </>
        ) : (
          <span className="muted">Toque numa coluna para ver os detalhes.</span>
        )}
      </div>

      <div className="chart__scroll">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={`Dor antes e depois em ${events.length} treinos. Valores na tabela abaixo.`}
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line
                className={t === 0 ? 'axis' : 'grid'}
                x1={LEFT}
                x2={width - RIGHT}
                y1={yOf(t)}
                y2={yOf(t)}
              />
              <text
                className="tick"
                x={LEFT - 8}
                y={yOf(t)}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {t}
              </text>
            </g>
          ))}

          {events.map((e, i) => {
            const x = xOf(i);
            const hollow = e.onAntiInflammatory === true;
            const noPain = e.painBefore === null && e.painAfter === null;
            return (
              <g key={e.id}>
                {active === i && (
                  <rect
                    className="column-hover"
                    x={x - BAND / 2 + 2}
                    y={TOP}
                    width={BAND - 4}
                    height={PLOT_H}
                    rx={6}
                  />
                )}
                {e.painBefore !== null && e.painAfter !== null && (
                  <line
                    className="connector"
                    x1={x}
                    x2={x}
                    y1={yOf(e.painBefore)}
                    y2={yOf(e.painAfter)}
                  />
                )}
                {e.painBefore !== null && (
                  <Dot x={x} y={yOf(e.painBefore)} tone="before" hollow={hollow} />
                )}
                {e.painAfter !== null && (
                  <Dot x={x} y={yOf(e.painAfter)} tone="after" hollow={hollow} />
                )}
                {noPain && (
                  <text className="tick" x={x} y={yOf(5)} textAnchor="middle">
                    sem nota
                  </text>
                )}
                <text className="tick" x={x} y={TOP + PLOT_H + 16} textAnchor="middle">
                  {formatDayMonth(e.date)}
                </text>
                <text className="tick tick--small" x={x} y={TOP + PLOT_H + 30} textAnchor="middle">
                  {kindLabel(e.kind)}
                </text>
                {/* Alvo de toque/foco: a coluna inteira, bem maior que o ponto. */}
                <rect
                  className="hit"
                  x={x - BAND / 2}
                  y={0}
                  width={BAND}
                  height={HEIGHT}
                  tabIndex={0}
                  aria-label={`${formatDayMonth(e.date)}, ${kindLabel(e.kind)}: dor ${formatPain(e.painBefore, e.painAfter)}`}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                  onFocus={() => setActive(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Dot({
  x,
  y,
  tone,
  hollow,
}: {
  x: number;
  y: number;
  tone: 'before' | 'after';
  hollow: boolean;
}) {
  return (
    <circle
      className={`dot dot--${tone}${hollow ? ' dot--hollow' : ''}`}
      cx={x}
      cy={y}
      r={hollow ? 5 : 5.5}
    />
  );
}
