import { useCallback, useEffect, useState } from 'react';
import type { TemplateDto } from '@knee/shared';
import { api, UnauthorizedError } from './api';
import { CORE_TEMPLATE_ID } from './config';
import { Player } from './player/Player';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; template: TemplateDto };

/** Aba "Treino": carrega o template e mostra o player. */
export function TrainingScreen({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  const fetchTemplate = useCallback(() => {
    let cancelled = false;
    api
      .getTemplate(CORE_TEMPLATE_ID)
      .then((template) => !cancelled && setLoad({ status: 'ready', template }))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof UnauthorizedError) return onUnauthorized();
        setLoad({
          status: 'error',
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [onUnauthorized]);

  useEffect(() => {
    if (load.status === 'loading') return fetchTemplate();
  }, [load.status, fetchTemplate]);

  if (load.status === 'loading') return <p className="screen-message">Carregando treino…</p>;
  if (load.status === 'error') {
    return (
      <div className="screen-message">
        <p>Não foi possível carregar o treino.</p>
        <p className="muted">{load.message}</p>
        <button className="button" onClick={() => setLoad({ status: 'loading' })}>
          Tentar de novo
        </button>
      </div>
    );
  }
  return <Player template={load.template} />;
}
