"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, MonitorOff, MonitorUp, Video, VideoOff } from "lucide-react";
import { sendSignal, subscribeSignals } from "@/lib/firestore";
import { cn } from "@/lib/utils";
import type { CallSignal } from "@/types";

type CallState = "starting" | "waiting" | "connecting" | "connected" | "reconnecting" | "error";

const iceServers: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  // A TURN relay is what makes calls work behind strict networks (some campus/corporate Wi-Fi, mobile data).
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [{ urls: process.env.NEXT_PUBLIC_TURN_URL.split(","), username: process.env.NEXT_PUBLIC_TURN_USERNAME, credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL }]
    : []),
];

const STATUS: Record<CallState, string> = {
  starting: "Starting your camera…",
  waiting: "Waiting for the other person to join…",
  connecting: "Connecting…",
  connected: "",
  reconnecting: "Connection lost. Reconnecting…",
  error: "",
};

/**
 * One-to-one video call that runs directly between the two browsers (WebRTC).
 * Firestore carries the connection setup messages, so there is no video server and no moderator.
 */
export default function VideoCall({ sessionId, uid }: { sessionId: string; uid: string }) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const camStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const [state, setState] = useState<CallState>("starting");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [hasCamera, setHasCamera] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);

  useEffect(() => {
    let disposed = false;
    const joinId = crypto.randomUUID();
    let remote: { uid: string; join: string } | null = null;
    let pc: RTCPeerConnection | null = null;
    let pending: RTCIceCandidateInit[] = [];
    let unsubscribe = () => {};

    const send = (signal: Pick<CallSignal, "type" | "to" | "data">) =>
      sendSignal(sessionId, { from: uid, fromJoin: joinId, ts: Date.now(), ...signal }).catch((e) => console.error("signal failed", e));

    // Exactly one side creates the offer; both compute the same answer from the two ids.
    const iOffer = () => !!remote && uid + joinId < remote.uid + remote.join;

    const resetPeer = () => {
      pc?.close();
      const peer = new RTCPeerConnection({ iceServers });
      pc = peer;
      pcRef.current = peer;
      pending = [];
      camStream.current?.getTracks().forEach((t) => peer.addTrack(t, camStream.current!));
      peer.ontrack = (e) => {
        if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0];
        setRemoteHasVideo(e.streams[0].getVideoTracks().length > 0);
      };
      peer.onicecandidate = (e) => {
        if (e.candidate && remote) send({ type: "candidate", to: remote.join, data: JSON.stringify(e.candidate.toJSON()) });
      };
      peer.onconnectionstatechange = () => {
        if (pc !== peer || disposed) return;
        if (peer.connectionState === "connected") setState("connected");
        else if (peer.connectionState === "disconnected") setState("reconnecting");
        else if (peer.connectionState === "failed") {
          setState("reconnecting");
          // Start over; the offering side sends a fresh offer, the other resets when it arrives.
          resetPeer();
          if (iOffer()) void makeOffer();
        }
      };
    };

    const makeOffer = async () => {
      const peer = pc;
      if (!peer || !remote) return;
      try {
        const offer = await peer.createOffer();
        if (pc !== peer) return;
        await peer.setLocalDescription(offer);
        send({ type: "offer", to: remote.join, data: JSON.stringify(peer.localDescription) });
      } catch (e) {
        console.error("offer failed", e);
      }
    };

    const adopt = (from: string, join: string) => {
      remote = { uid: from, join };
      setState("connecting");
      resetPeer();
      if (iOffer()) void makeOffer();
    };

    const flush = async (peer: RTCPeerConnection) => {
      for (const c of pending.splice(0)) await peer.addIceCandidate(c).catch(() => {});
    };

    const handle = async (s: CallSignal) => {
      if (s.fromJoin === joinId || (s.to && s.to !== joinId) || disposed) return;
      if (!remote || remote.join !== s.fromJoin) {
        if (s.type === "answer" || s.type === "candidate") return; // from a peer we've moved on from
        adopt(s.from, s.fromJoin);
      }
      const peer = pc;
      if (!peer || !s.data && s.type !== "hello") return;
      try {
        if (s.type === "offer" && !iOffer()) {
          if (peer.remoteDescription) resetPeer(); // a new offer on a used connection means "start over"
          const active = pc!;
          await active.setRemoteDescription(JSON.parse(s.data!));
          await flush(active);
          const answer = await active.createAnswer();
          await active.setLocalDescription(answer);
          send({ type: "answer", to: s.fromJoin, data: JSON.stringify(active.localDescription) });
        } else if (s.type === "answer" && iOffer() && peer.signalingState === "have-local-offer") {
          await peer.setRemoteDescription(JSON.parse(s.data!));
          await flush(peer);
        } else if (s.type === "candidate") {
          const candidate = JSON.parse(s.data!);
          if (peer.remoteDescription) await peer.addIceCandidate(candidate).catch(() => {});
          else pending.push(candidate);
        }
      } catch (e) {
        console.error("signal handling failed", s.type, e);
      }
    };

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // no camera: join with voice only
          setHasCamera(false);
          setCamOn(false);
        } catch {
          if (!disposed) {
            setError(
              navigator.mediaDevices
                ? "Camera and microphone access is blocked. Allow access in your browser's address bar, then try again."
                : "This page needs HTTPS (or localhost) to use your camera."
            );
            setState("error");
          }
          return;
        }
      }
      if (disposed) return stream.getTracks().forEach((t) => t.stop());
      camStream.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      setState("waiting");

      unsubscribe = subscribeSignals(sessionId, (signals, initial) => {
        if (disposed) return;
        if (initial) {
          // Only the newest hello per other person matters; older ones are previous visits.
          const latest = [...signals].reverse().find((s) => s.fromJoin !== joinId && (s.type === "hello" || s.type === "offer"));
          if (latest) adopt(latest.from, latest.fromJoin);
          return;
        }
        signals.forEach((s) => void handle(s));
      });
      send({ type: "hello" });
    })();

    return () => {
      disposed = true;
      unsubscribe();
      pc?.close();
      pcRef.current = null;
      camStream.current?.getTracks().forEach((t) => t.stop());
      screenStream.current?.getTracks().forEach((t) => t.stop());
      camStream.current = null;
      screenStream.current = null;
    };
  }, [sessionId, uid, attempt]);

  const toggleMic = () => {
    const track = camStream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const toggleCam = () => {
    const track = camStream.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };

  const stopSharing = useCallback(() => {
    screenStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current = null;
    const cam = camStream.current?.getVideoTracks()[0];
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
    if (cam && sender) void sender.replaceTrack(cam);
    if (localVideo.current && camStream.current) localVideo.current.srcObject = camStream.current;
    setSharing(false);
  }, []);

  const toggleShare = async () => {
    if (sharing) return stopSharing();
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = screen.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      if (!sender) {
        screen.getTracks().forEach((t) => t.stop());
        return;
      }
      await sender.replaceTrack(track);
      screenStream.current = screen;
      if (localVideo.current) localVideo.current.srcObject = screen;
      track.onended = stopSharing;
      setSharing(true);
    } catch {
      /* the user cancelled the picker */
    }
  };

  const canShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia && hasCamera;

  return (
    <div className="absolute inset-0 bg-[#060608]">
      <video ref={remoteVideo} autoPlay playsInline className={cn("h-full w-full bg-black object-contain", state !== "connected" && "invisible")} />

      {state === "connected" && !remoteHasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
          <VideoOff className="h-8 w-8" />
          <p className="text-sm">The other person joined without a camera</p>
        </div>
      )}

      {state !== "connected" && state !== "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="max-w-xs text-sm text-slate-300">{STATUS[state]}</p>
        </div>
      )}

      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <VideoOff className="h-9 w-9 text-rose-400" />
          <p className="max-w-sm text-sm text-slate-300">{error}</p>
          <button onClick={() => { setError(""); setState("starting"); setAttempt((a) => a + 1); }} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500">
            Try again
          </button>
        </div>
      )}

      {/* Self view */}
      <div className={cn("absolute bottom-20 right-4 h-28 w-44 overflow-hidden rounded-xl border border-white/15 bg-black shadow-xl", state === "error" && "hidden")}>
        <video ref={localVideo} autoPlay playsInline muted className={cn("h-full w-full object-cover", !sharing && "-scale-x-100", !camOn && !sharing && "invisible")} />
        {!camOn && !sharing && <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">Camera off</div>}
      </div>

      {state !== "error" && state !== "starting" && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/60 p-1.5 backdrop-blur">
          <Control on={micOn} onClick={toggleMic} label={micOn ? "Mute" : "Unmute"} icon={micOn ? Mic : MicOff} />
          {hasCamera && <Control on={camOn} onClick={toggleCam} label={camOn ? "Turn camera off" : "Turn camera on"} icon={camOn ? Video : VideoOff} />}
          {canShare && <Control on={!sharing} accent={sharing} onClick={toggleShare} label={sharing ? "Stop sharing" : "Share screen"} icon={sharing ? MonitorOff : MonitorUp} />}
        </div>
      )}
    </div>
  );
}

function Control({ on, accent, onClick, label, icon: Icon }: { on: boolean; accent?: boolean; onClick: () => void; label: string; icon: typeof Mic }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn("flex h-10 w-10 items-center justify-center rounded-full transition-colors", accent ? "bg-blue-600 text-white" : on ? "bg-white/10 text-white hover:bg-white/20" : "bg-rose-600 text-white")}
    >
      <Icon className="h-4.5 w-4.5" />
    </button>
  );
}
