/** Lembra a última resposta sobre anti-inflamatório neste aparelho (só conveniência). */
const KEY = 'treino-joelho:anti-inflammatory';

export function readAntiInflammatory(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveAntiInflammatory(value: boolean): void {
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    // armazenamento indisponível: só não lembra na próxima vez
  }
}
