// Fetches a LiveKit access token + server URL from the token endpoint, which
// responds with: { "token": string, "url": string }.
//
// Auth against the Choreo-exposed API uses the OAuth2 client-credentials grant:
// the client exchanges the application's Consumer Key + Consumer Secret for a
// short-lived bearer token at Choreo's token endpoint (served on the same
// gateway host as the API), then calls the getToken API with
// `Authorization: Bearer <access-token>`. The bearer token is cached in memory
// and reused until shortly before it expires.
//
// Configure via Vite env vars (put real values in client/.env or .env.local —
// see .env.example):
//
//   VITE_TOKEN_URL        Full URL (or dev-proxy path) of the getToken endpoint
//                         (e.g. the Choreo-exposed https://.../getToken)
//   VITE_TOKEN_ENDPOINT   Choreo token endpoint that mints access tokens
//                         (e.g. https://<gateway-host>/oauth2/token, or a
//                         dev-proxy path like /choreo/oauth2/token)
//   VITE_CONSUMER_KEY     Application consumer key (OAuth2 client id)
//   VITE_CONSUMER_SECRET  Application consumer secret (OAuth2 client secret)
//
// Legacy fallback — used only when consumer key/secret are not set:
//   VITE_TOKEN_API_KEY         Pre-generated static Choreo API key
//   VITE_TOKEN_API_KEY_HEADER  Header name for that key (default: api-key)
//
// NOTE: VITE_* vars are baked into the client bundle at build time and are
// therefore visible to anyone who inspects the page. The consumer secret here
// is exposed to browsers — only use credentials scoped to what a public client
// may do. For a hardened setup, move the token exchange to a backend.

export interface ConnectionDetails {
  token: string;
  url: string;
}

const TOKEN_URL = import.meta.env.VITE_TOKEN_URL ?? 'http://localhost:8006/getToken';

// Choreo OAuth2 client-credentials config.
const TOKEN_ENDPOINT = import.meta.env.VITE_TOKEN_ENDPOINT ?? '';
const CONSUMER_KEY = import.meta.env.VITE_CONSUMER_KEY ?? '';
const CONSUMER_SECRET = import.meta.env.VITE_CONSUMER_SECRET ?? '';

// Legacy static-key fallback.
const TOKEN_API_KEY = import.meta.env.VITE_TOKEN_API_KEY ?? '';
const TOKEN_API_KEY_HEADER = import.meta.env.VITE_TOKEN_API_KEY_HEADER ?? 'api-key';

interface AccessToken {
  value: string;
  // epoch millis after which the token should no longer be reused
  expiresAt: number;
}

// Refresh the bearer token this many ms before it actually expires, so an
// in-flight request never races the expiry.
const EXPIRY_SKEW_MS = 60_000;

let cachedToken: AccessToken | null = null;
// De-dupe concurrent refreshes: many connect clicks share one token request.
let pendingToken: Promise<string> | null = null;

function base64(input: string): string {
  // Consumer key/secret are ASCII, so btoa is safe here (client runs in the
  // browser, where btoa is always available).
  return btoa(input);
}

// Exchanges the consumer key/secret for an OAuth2 access token via Choreo's
// token endpoint (client-credentials grant). Caches and reuses the token
// until it is close to expiring.
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - EXPIRY_SKEW_MS > now) {
    return cachedToken.value;
  }
  if (pendingToken) return pendingToken;

  if (!TOKEN_ENDPOINT) {
    throw new Error('VITE_TOKEN_ENDPOINT is not configured');
  }

  pendingToken = (async () => {
    const endpoint = new URL(TOKEN_ENDPOINT, window.location.origin);
    const body = new URLSearchParams({ grant_type: 'client_credentials' });

    const response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Basic ${base64(`${CONSUMER_KEY}:${CONSUMER_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Token endpoint failed: ${response.status} ${response.statusText}` +
          (detail ? ` — ${detail}` : ''),
      );
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      token_type?: string;
    };
    if (!data.access_token) {
      throw new Error('Token endpoint response missing "access_token"');
    }

    const ttlMs = (data.expires_in ?? 3600) * 1000;
    cachedToken = { value: data.access_token, expiresAt: Date.now() + ttlMs };
    return data.access_token;
  })();

  try {
    return await pendingToken;
  } catch (err) {
    // Don't cache failures — let the next call retry the exchange.
    cachedToken = null;
    throw err;
  } finally {
    pendingToken = null;
  }
}

// Builds the auth header for a getToken request. Prefers the OAuth2 bearer
// token; falls back to a static API key header when consumer credentials are
// not configured.
async function authHeaders(): Promise<Record<string, string>> {
  if (CONSUMER_KEY && CONSUMER_SECRET) {
    return { Authorization: `Bearer ${await getAccessToken()}` };
  }
  if (TOKEN_API_KEY) {
    return { [TOKEN_API_KEY_HEADER]: TOKEN_API_KEY };
  }
  return {};
}

export async function fetchConnectionDetails(
  participantName: string,
  roomName = 'voice-room',
): Promise<ConnectionDetails> {
  // Accept both absolute URLs (prod) and relative paths like /choreo/... that
  // hit the Vite dev proxy (resolved against the page origin).
  const url = new URL(TOKEN_URL, window.location.origin);
  url.searchParams.set('roomName', roomName);
  url.searchParams.set('participantName', participantName);

  const response = await fetch(url.toString(), { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Partial<ConnectionDetails>;
  if (!data.token || !data.url) {
    throw new Error('Token response missing "token" or "url"');
  }
  return { token: data.token, url: data.url };
}
