import { useCallback, useEffect, useRef, useState } from 'react';
import type { WebRtcSignalPayload } from '@xadrez3d/shared';
import { onIceServers, onWebRtcSignal, sendWebRtcSignal } from './socket';

interface UseWebRtcOptions {
  roomCode: string | null;
  localPlayerId: string | null;
  remotePlayerId: string | null;
  enabled: boolean;
}

export function useWebRtc({
  roomCode,
  localPlayerId,
  remotePlayerId,
  enabled,
}: UseWebRtcOptions) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([
    { urls: 'stun:stun.l.google.com:19302' },
  ]);
  const makingOffer = useRef(false);
  const polite = useRef(false);

  useEffect(() => onIceServers((p) => setIceServers(p.iceServers)), []);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const ensurePc = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      setRemoteStream(stream);
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate || !roomCode || !localPlayerId || !remotePlayerId) return;
      sendWebRtcSignal({
        roomCode,
        fromPlayerId: localPlayerId,
        toPlayerId: remotePlayerId,
        type: 'ice',
        signal: ev.candidate.toJSON(),
      });
    };

    return pc;
  }, [iceServers, localPlayerId, remotePlayerId, roomCode]);

  const ensureLocalMedia = useCallback(async (wantCam: boolean, wantMic: boolean) => {
    if (!wantCam && !wantMic) {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      return null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: wantMic,
      video: wantCam
        ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const attachLocalTracks = useCallback(
    async (wantCam: boolean, wantMic: boolean) => {
      if (!roomCode || !localPlayerId || !remotePlayerId || !enabled) return;
      const pc = ensurePc();
      const stream = await ensureLocalMedia(wantCam, wantMic);

      // Remove old senders
      for (const sender of pc.getSenders()) {
        if (sender.track) pc.removeTrack(sender);
      }

      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }
      }

      polite.current = localPlayerId > remotePlayerId;
      makingOffer.current = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWebRtcSignal({
          roomCode,
          fromPlayerId: localPlayerId,
          toPlayerId: remotePlayerId,
          type: 'offer',
          signal: {
            type: offer.type,
            sdp: offer.sdp,
          },
        });
      } finally {
        makingOffer.current = false;
      }
    },
    [enabled, ensureLocalMedia, ensurePc, localPlayerId, remotePlayerId, roomCode],
  );

  useEffect(() => {
    if (!enabled || !roomCode || !localPlayerId || !remotePlayerId) {
      cleanup();
      return;
    }

    void attachLocalTracks(camOn, micOn);

    const off = onWebRtcSignal(async (payload) => {
      if (payload.toPlayerId !== localPlayerId) return;
      if (payload.fromPlayerId !== remotePlayerId) return;
      const pc = ensurePc();

      try {
        if (payload.type === 'offer') {
          const offerCollision = makingOffer.current || pc.signalingState !== 'stable';
          if (offerCollision && !polite.current) return;
          await pc.setRemoteDescription(payload.signal as RTCSessionDescriptionInit);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWebRtcSignal({
            roomCode,
            fromPlayerId: localPlayerId,
            toPlayerId: remotePlayerId,
            type: 'answer',
            signal: {
              type: answer.type,
              sdp: answer.sdp,
            },
          });
        } else if (payload.type === 'answer') {
          await pc.setRemoteDescription(payload.signal as RTCSessionDescriptionInit);
        } else if (payload.type === 'ice') {
          try {
            await pc.addIceCandidate(payload.signal as RTCIceCandidateInit);
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.warn('WebRTC signal error', err);
      }
    });

    return () => {
      off();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomCode, localPlayerId, remotePlayerId]);

  const toggleMic = async () => {
    const next = !micOn;
    setMicOn(next);
    const audio = localStreamRef.current?.getAudioTracks()[0];
    if (audio) audio.enabled = next;
    else if (next) await attachLocalTracks(camOn, true);
  };

  const toggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    await attachLocalTracks(next, micOn);
  };

  return {
    localStream,
    remoteStream,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
  };
}
