import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: {
        'index': 'src/index.ts',
        'tlp': 'src/tlp/index.ts',
        'cvss': 'src/cvss/index.ts',
        'cvss-v4': 'src/cvss-v4/index.ts',
        'cedar-valley': 'src/cedar-valley/index.ts',
        'cedar-valley-protection': 'src/cedar-valley-protection/index.ts',
        'cedar-valley-handling': 'src/cedar-valley-handling/index.ts',
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    outDir: 'dist/lib',
    emptyOutDir: true,
    rollupOptions: {
      // src/ is scheme YAML strings and must remain dependency-free. Keep any
      // accidental first-party import bare so the tarball boundary can reject
      // it by name instead of letting Vite inline proprietary implementation.
      external: (id) => id.startsWith('node:') || id.startsWith('@ezclassify/'),
    },
    // The `files` field deliberately keeps `.map` files out of the tarball, so
    // emitting them would only leave every shipped chunk pointing at a
    // sourceMappingURL that is not there. The authored source is in this
    // repository for anyone who wants to read it.
    sourcemap: false,
    target: 'node22',
  },
  plugins: [dts({ tsconfigPath: './tsconfig.lib.json' })],
})
