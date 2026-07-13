import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        axina: resolve(__dirname, 'axina/index.html'),
      },
    },
  },
})
