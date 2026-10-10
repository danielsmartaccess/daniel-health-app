import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testes de banco real só rodam via vitest.db.config.ts
    exclude: [...configDefaults.exclude, '**/*.db.test.ts'],
  },
});
