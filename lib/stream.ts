import { StreamChat } from "stream-chat";

let serverClient: StreamChat | null = null;

/**
 * Returns a server-side Stream Chat client (singleton).
 * Uses the secret key — never import this in client components.
 */
export function getStreamServerClient(): StreamChat | null {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const secret = process.env.STREAM_API_SECRET;
  if (!apiKey || !secret) return null;

  if (!serverClient) {
    serverClient = StreamChat.getInstance(apiKey, secret);
  }
  return serverClient;
}
