import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative base so the build works from any path, e.g. https://<user>.github.io/q-circuit-composer/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
