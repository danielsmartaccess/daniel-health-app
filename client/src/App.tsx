import { useEffect, useState } from 'react';
import type { TemplateDto } from '@knee/shared';
import { api } from './api';
import { CORE_TEMPLATE_ID } from './config';
import { Player } from './player/Player';

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; template: TemplateDto };

export function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api
      .getTemplate(CORE_TEMPLATE_ID)
      .then((template) => !cancelled && setLoad({ status: 'ready', template }))
      .catch(
        (error: unknown) =>
          !cancelled &&
          setLoad({
            status: 'error',
            message: error instanceof Error ? error.message : 'Erro desconhecido',
          }),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  if (load.status === 'loading') return <p className="screen-message">Carregando treino…</p>;
  if (load.status === 'error') {
    return (
      <div className="screen-message">
        <p>Não foi possível carregar o treino.</p>
        <p className="muted">{load.message}</p>
        <button className="button" onClick={() => window.location.reload()}>
          Tentar de novo
        </button>
      </div>
    );
  }
  return <Player template={load.template} />;
}
