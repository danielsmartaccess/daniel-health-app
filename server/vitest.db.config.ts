import { defineConfig } from 'vitest/config';

// Testes contra o banco REAL (produção: não há banco de desenvolvimento).
// Rodam só sob demanda: npm run test:db -w @knee/server
export default defineConfig({
  test: {
    include: ['src/**/*.db.test.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
