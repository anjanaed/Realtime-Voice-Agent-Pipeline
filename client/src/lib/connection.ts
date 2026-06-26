// Fetches a LiveKit access token + server URL from the token endpoint, which
// responds with: { "token": string, "url": string }
//
// Configure via Vite env vars (put real values in client/.env.local — see
// .env.example). With none set it falls back to the local dev server on :8006.
//
//   VITE_TOKEN_URL             Full URL of the getToken endpoint
//                              (e.g. the Choreo-exposed https://.../getToken)
//   VITE_TOKEN_API_KEY         Choreo API key, sent as a request header
//   VITE_TOKEN_API_KEY_HEADER  Header name for the key (default: api-key, which
//                              is the header Choreo's generated API keys use)
//
// NOTE: VITE_* vars are baked into the client bundle at build time and are
// therefore visible to anyone who inspects the page. Only use a key here that
// is acceptable to expose to browsers.

export interface ConnectionDetails {
  token: string;
  url: string;
}

const TOKEN_URL = import.meta.env.VITE_TOKEN_URL ?? 'http://localhost:8006/getToken';
const TOKEN_API_KEY = import.meta.env.VITE_TOKEN_API_KEY ?? '';
const TOKEN_API_KEY_HEADER = import.meta.env.VITE_TOKEN_API_KEY_HEADER ?? 'api-key';

export async function fetchConnectionDetails(
  participantName: string,
  roomName = 'voice-room',
): Promise<ConnectionDetails> {
  // Accept both absolute URLs (prod) and relative paths like /choreo/... that
  // hit the Vite dev proxy (resolved against the page origin).
  const url = new URL(TOKEN_URL, window.location.origin);
  url.searchParams.set('roomName', roomName);
  url.searchParams.set('participantName', participantName);

  const headers: Record<string, string> = {};
  if (TOKEN_API_KEY) headers[TOKEN_API_KEY_HEADER] = TOKEN_API_KEY;

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Partial<ConnectionDetails>;
  if (!data.token || !data.url) {
    throw new Error('Token response missing "token" or "url"');
  }
  return { token: data.token, url: data.url };
}
