/** Contagem regressiva: arredonda para cima (mostra 0:01 até zerar de fato). */
export function formatCountdown(ms: number): string {
  return formatSeconds(Math.ceil(Math.max(0, ms) / 1000));
}

/** Tempo decorrido: arredonda para baixo. */
export function formatElapsed(ms: number): string {
  return formatSeconds(Math.floor(Math.max(0, ms) / 1000));
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
