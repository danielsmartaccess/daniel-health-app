import express, { type Express } from 'express';

/**
 * Monta o app Express. As rotas de negócio entram nos cards 2.x;
 * aqui fica só o health check usado para validar o scaffold.
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
