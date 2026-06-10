"use client";

import { useEffect, useRef, useState } from "react";
import {
  Room, RoomEvent, Track,
  type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant,
} from "livekit-client";
import { Loader2, Radio, Users } from "lucide-react";

interface LiveRoomProps {
  wsUrl: string;
  token: string;
  isHost: boolean;
}

/**
 * Connects to a LiveKit room. The host publishes camera+mic; viewers subscribe
 * and watch. Renders the active video into a single full-bleed container.
 */
export default function LiveRoom({ wsUrl, token, isHost }: LiveRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    let cancelled = false;

    function attach(track: RemoteTrack | Track) {
      const el = track.attach();
      if (track.kind === "video") {
        el.className = "h-full w-full object-cover";
        containerRef.current?.replaceChildren(el);
      } else {
        // audio — keep in DOM (hidden) so it plays
        el.style.display = "none";
        containerRef.current?.appendChild(el);
      }
    }

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => attach(track))
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => track.detach().forEach((el) => el.remove()))
      .on(RoomEvent.ParticipantConnected, () => setViewers(room.numParticipants))
      .on(RoomEvent.ParticipantDisconnected, () => setViewers(room.numParticipants))
      .on(RoomEvent.Disconnected, () => { if (!cancelled) setStatus("error"); });

    (async () => {
      try {
        await room.connect(wsUrl, token);
        if (cancelled) { room.disconnect(); return; }
        setViewers(room.numParticipants);

        if (isHost) {
          await room.localParticipant.enableCameraAndMicrophone();
          const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (pub?.track) {
            const el = pub.track.attach();
            el.className = "h-full w-full object-cover";
            el.muted = true; // avoid local echo
            containerRef.current?.replaceChildren(el);
          }
        } else {
          // Attach any tracks already published before we subscribed.
          room.remoteParticipants.forEach((p: RemoteParticipant) => {
            p.trackPublications.forEach((pub: RemoteTrackPublication) => {
              if (pub.track) attach(pub.track);
            });
          });
        }
        setStatus("live");
      } catch (e) {
        console.error("[LiveRoom] connect failed:", e);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
    };
  }, [wsUrl, token, isHost]);

  return (
    <div className="relative aspect-[9/16] w-full max-h-[70vh] overflow-hidden rounded-2xl bg-black sm:aspect-video">
      <div ref={containerRef} className="h-full w-full" />

      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 size={28} className="animate-spin text-white/80" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-[13px] text-white/80">
          Connection lost
        </div>
      )}

      {/* Live + viewer badges */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white">
          <Radio size={11} /> LIVE
        </span>
        <span className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <Users size={11} /> {Math.max(0, viewers)}
        </span>
      </div>
    </div>
  );
}
