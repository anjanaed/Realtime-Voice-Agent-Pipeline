import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// No dev proxy needed: the browser only talks to the BFF (which serves CORS
// headers); all Choreo gateway communication happens inside the BFF.
export default defineConfig({
  plugins: [react()],
})
