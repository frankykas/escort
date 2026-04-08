import { AccessToken } from "livekit-server-sdk";

/**
 * Creates a LiveKit access token for a user to join a specific chat room.
 * Each accepted conversation maps to one LiveKit room (named by channelId).
 *
 * Grants data-channel publish/subscribe only — no audio/video.
 */
export async function createLiveKitToken(userId: string, roomName: string): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set");
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    ttl: "12h",
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublishData: true,
    canPublish: false,
    canSubscribe: true,
  });

  return token.toJwt();
}

/**
 * Returns the LiveKit WebSocket URL from env.
 */
export function getLiveKitWsUrl(): string {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL;
  if (!url) throw new Error("NEXT_PUBLIC_LIVEKIT_WS_URL must be set");
  return url;
}
