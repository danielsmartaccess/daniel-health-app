import express, { type Express } from 'express';
import { requireDeviceToken } from './auth';
import { errorHandler } from './errors';
import { createApiRouter, type ApiDeps } from './routes';

export interface AppDeps extends ApiDeps {
  /** Chave do aparelho exigida em todas as rotas, exceto /api/health. */
  deviceToken: string;
}

/** Monta o app Express. Dependências injetadas: repositório, dono, relógio e chave. */
export function createApp({ deviceToken, ...deps }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  // Dados de saúde: nada de cache em navegador, CDN ou proxy.
  app.use('/api', (_req, res, next) => {
    res.set({
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api', requireDeviceToken(deviceToken));
  app.use('/api', createApiRouter(deps));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });
  app.use(errorHandler);

  return app;
}
