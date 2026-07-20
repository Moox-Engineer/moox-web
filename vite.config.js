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
    // Must stay true: /newhome ships its own design-system stylesheet, and a
    // single merged bundle would leak its global body/a/:root rules onto the
    // other pages (and style.css onto /newhome).
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        axina: resolve(__dirname, 'axina/index.html'),
        newhome: resolve(__dirname, 'newhome/index.html'),
        testing1: resolve(__dirname, 'testing1/index.html'),
      },
    },
  },
})
