import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5177,
    watch: {
      ignored: ['**/体素广州-新中轴.html', '**/dist-single/**', '**/output/**', '**/*.zip'],
    },
  },
});
