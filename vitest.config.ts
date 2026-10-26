export default {
  test: {
    globals: true,
    include: ['schemes/*/*/tests/**/*.spec.ts', 'tests/**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
}
