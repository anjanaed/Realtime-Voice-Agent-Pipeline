import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const choreoOrigin = env.VITE_CHOREO_ORIGIN

  return {
    plugins: [react()],
    server: {
      // Dev-only proxy: the browser calls a same-origin /choreo/... path (no
      // CORS preflight), and Vite forwards it server-side to the Choreo
      // gateway (server-to-server has no CORS). Set VITE_CHOREO_ORIGIN in .env
      // to the gateway origin, e.g.
      //   https://0b173e69-...-dev.e1-us-east-azure.choreoapis.dev
      proxy: choreoOrigin
        ? {
            '/choreo': {
              target: choreoOrigin,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(/^\/choreo/, ''),
            },
          }
        : undefined,
    },
  }
})
