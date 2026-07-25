import { useEffect, useRef } from 'react';

interface MediaPanelProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  camOn: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  remoteNickname?: string;
}

export function MediaPanel({
  localStream,
  remoteStream,
  micOn,
  camOn,
  onToggleMic,
  onToggleCam,
  remoteNickname = 'Oponente',
}: MediaPanelProps) {
  return (
    <div className="panel media-panel">
      <h3>Voz & Webcam</h3>
      <div className="media-grid">
        <VideoTile stream={remoteStream} label={remoteNickname} muted={false} />
        <VideoTile stream={localStream} label="Você" muted mirrored />
      </div>
      <div className="media-actions">
        <button type="button" className={micOn ? '' : 'ghost'} onClick={onToggleMic}>
          {micOn ? 'Mic ligado' : 'Mic mudo'}
        </button>
        <button type="button" className={camOn ? '' : 'ghost'} onClick={onToggleCam}>
          {camOn ? 'Câmera ligada' : 'Câmera off'}
        </button>
      </div>
    </div>
  );
}

function VideoTile({
  stream,
  label,
  muted,
  mirrored,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  mirrored?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="video-tile">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        style={{ transform: mirrored ? 'scaleX(-1)' : undefined }}
      />
      {!stream && <div className="video-placeholder">Sem vídeo</div>}
      <span>{label}</span>
    </div>
  );
}
