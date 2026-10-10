/** Fuso de referência do app. A data de `daily_logs` é sempre a data local daqui, nunca UTC. */
export const APP_TIME_ZONE = 'America/Sao_Paulo';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Data local em America/Sao_Paulo no formato 'YYYY-MM-DD'.
 * Exemplo: 2026-10-11T02:30:00Z (23h30 do dia 10 em São Paulo) → '2026-10-10'.
 */
export function localDate(instant: Date | number): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) throw new RangeError('Instante inválido');

  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
