import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// CI runs the suite as 4 parallel shards (`--shard=N/4`), each executing only
// ~25% of the tests. A file's own tests can land in a different shard than the
// file itself, so a single shard's coverage for that file is legitimately 0%
// even though the merged report (which is what CI actually enforces
// thresholds against, see .github/workflows/ci.yml's unit-test-coverage job)
// is well above floor. CI zeroes the four top-level threshold keys per shard
// via `--coverage.thresholds.*` CLI flags, but that dot-path override can't
// reach the nested per-file glob keys below, so we gate them here instead
// (#626).
const isSharded = process.argv.some((arg) => arg === '--shard' || arg.startsWith('--shard='))

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    unstubGlobals: true,
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/main.tsx',
        'src/setupTests.ts',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
      ],
      thresholds: {
        // Current coverage floor — raised incrementally from 70/60/60/70 (v0.8.0)
        // through 75/65/65/75 (v0.9.0) to the current 80/70/70/80 target.
        statements: 80,
        branches: 70,
        functions: 70,
        lines: 80,
        // Higher per-file floor for the app's security-critical boundary
        // files (#626) — the repo-wide average can stay green while one of
        // these regresses. Omitted on sharded CI runs; see isSharded above.
        ...(isSharded
          ? {}
          : {
              'src/services/api/http.ts': {
                statements: 95,
                branches: 90,
                functions: 95,
                lines: 95,
              },
              'src/pages/CallbackPage.tsx': {
                statements: 95,
                branches: 90,
                functions: 95,
                lines: 95,
              },
              'src/components/MarkdownRenderer.tsx': {
                statements: 95,
                branches: 90,
                functions: 95,
                lines: 95,
              },
              'src/utils/externalUrl.ts': {
                statements: 95,
                branches: 90,
                functions: 95,
                lines: 95,
              },
            }),
      },
    },
  },
})
