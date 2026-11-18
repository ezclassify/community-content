export default {
  test: {
    setupFiles: ['./test-support/fail-on-console-error.mjs'],
    globals: true,
    include: ['schemes/*/*/tests/**/*.spec.ts', 'tests/**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
}
