// Fetches a LiveKit access token + server URL from the BFF token server,
// which responds with: { "token": string, "url": string }.
//
// All Choreo concerns (OAuth2 client-credentials exchange, consumer key and
// secret, gateway URLs) live in the BFF — nothing sensitive is stored in or
// shipped with the client bundle. The LiveKit server URL is not configured
// here either; it arrives in the BFF response, sourced from server-side
// config.
//
// Configure via Vite env vars (see .env.example):
//
//   VITE_TOKEN_URL   Full URL of the BFF getToken endpoint
//                    (default: http://localhost:8007/getToken)

export interface ConnectionDetails {
  token: string;
  url: string;
}

const TOKEN_URL = import.meta.env.VITE_TOKEN_URL ?? 'http://localhost:8007/getToken';

export async function fetchConnectionDetails(
  participantName: string,
  roomName = 'voice-room',
): Promise<ConnectionDetails> {
  // Accept both absolute URLs (prod) and relative paths (resolved against the
  // page origin, e.g. when the BFF is served behind the same host).
  const url = new URL(TOKEN_URL, window.location.origin);
  url.searchParams.set('roomName', roomName);
  url.searchParams.set('participantName', participantName);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Partial<ConnectionDetails>;
  if (!data.token || !data.url) {
    throw new Error('Token response missing "token" or "url"');
  }
  return { token: data.token, url: data.url };
}
