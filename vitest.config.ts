import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    // Все тесты в один форк, последовательно: общий sqlite + транзакции
    // не переносят параллельного запуска.
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
  },
});
