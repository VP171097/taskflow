import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// VITE_BASE is set to "/taskflow/" by the GitHub Pages workflow; local dev and Firebase Hosting use "/".
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
})
