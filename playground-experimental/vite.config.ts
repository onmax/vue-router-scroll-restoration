import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  root: import.meta.dirname,
  plugins: [vue()],
  build: { outDir: `dist-${mode}` },
}))
