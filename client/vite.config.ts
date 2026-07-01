import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const choreoOrigin = env.VITE_CHOREO_ORIGIN

  // Dev-only proxy: the browser calls a same-origin /choreo/... path (no CORS
  // preflight), and Vite forwards it server-side to the Choreo gateway
  // (server-to-server has no CORS). This covers BOTH the OAuth2 token endpoint
  // (/choreo/oauth2/token) and the API (/choreo/pipeline/.../getToken), since
  // both live on the same gateway host. Set VITE_CHOREO_ORIGIN in .env to the
  // gateway origin, e.g.
  //   https://0b173e69-...-prod.e1-us-east-azure.choreoapis.dev
  const proxy: Record<string, ProxyOptions> = {}
  if (choreoOrigin) {
    proxy['/choreo'] = {
      target: choreoOrigin,
      changeOrigin: true,
      secure: true,
      rewrite: (path: string) => path.replace(/^\/choreo/, ''),
    }
  }

  return {
    plugins: [react()],
    server: {
      proxy: Object.keys(proxy).length ? proxy : undefined,
    },
  }
})
