import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vitest's own transform pipeline (vite-node) doesn't pick up the react
  // plugin's automatic JSX runtime the way the real dev/build server does
  // -- component test files (Containers.test.jsx, the first one that
  // actually renders JSX) failed with "React is not defined" without this.
  // No-op for the real app: the react plugin already injects the
  // automatic-runtime import there, so this line is redundant but harmless.
  esbuild: {
    jsxInject: "import React from 'react'",
  },
})
