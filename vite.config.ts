import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Vercel / custom domain (visualgit.dev) serves from the root, while GitHub
// Pages serves from the /visual-git-tutorial/ project subpath. Pick the base
// per host so asset URLs resolve correctly on both.
export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? '/' : '/visual-git-tutorial/',
})
