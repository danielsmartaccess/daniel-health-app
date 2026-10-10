import type { SegmentView } from './view';

/**
 * Barra de progresso "tipo vídeo": um segmento por bloco, com largura proporcional
 * à duração estimada. Trabalho e descanso têm cores diferentes.
 */
export function Timeline({ segments, overall }: { segments: SegmentView[]; overall: number }) {
  const percent = Math.round(overall * 100);
  return (
    <div
      className="timeline"
      role="progressbar"
      aria-label="Progresso do treino"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      {segments.map((segment, i) => (
        <div
          key={i}
          className={`segment segment--${segment.kind}${segment.current ? ' segment--current' : ''}`}
          style={{ flexGrow: segment.weight }}
        >
          <div className="segment__fill" style={{ transform: `scaleX(${segment.fill})` }} />
        </div>
      ))}
    </div>
  );
}
