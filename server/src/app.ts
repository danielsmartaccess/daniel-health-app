import express, { type Express } from 'express';
import { errorHandler } from './errors';
import { createApiRouter, type ApiDeps } from './routes';

/** Monta o app Express. Dependências injetadas: repositório, dono e relógio. */
export function createApp(deps: ApiDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api', createApiRouter(deps));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });
  app.use(errorHandler);

  return app;
}
