import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ChatMessage, PieceColor, RoomState } from '@xadrez3d/shared';
import { Chess } from 'chess.js';
import { ChatPanel } from '../components/ChatPanel';
import { ChessBoardCanvas } from '../components/ChessBoard';
import { MediaPanel } from '../components/MediaPanel';
import { Shell } from '../components/Shell';
import { formatClock, getLegalTargets } from '../lib/chessLocal';
import {
  clearSession,
  createRoom,
  joinRoom,
  leaveRoom,
  loadSession,
  offerDraw,
  onChatHistory,
  onChatMessage,
  onRoomError,
  onRoomState,
  resignGame,
  respondDraw,
  saveSession,
  sendChat,
  sendMove,
} from '../lib/socket';
import { useWebRtc } from '../lib/useWebRtc';
import './pages.css';

export function MultiplayerPage() {
  const { code: routeCode } = useParams();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(
    () => localStorage.getItem('xadrez3d.nickname') || '',
  );
  const [joinCode, setJoinCode] = useState(routeCode?.toUpperCase() || '');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asSpectator, setAsSpectator] = useState(false);

  const me = useMemo(
    () => room?.players.find((p) => p.id === playerId) ?? null,
    [room, playerId],
  );

  const opponent = useMemo(() => {
    if (!room || !me || me.role === 'spectator') return null;
    const oppRole = me.role === 'white' ? 'black' : 'white';
    return room.players.find((p) => p.role === oppRole) ?? null;
  }, [room, me]);

  const orientation: PieceColor = me?.role === 'black' ? 'b' : 'w';
  const canMove =
    !!room &&
    room.status === 'playing' &&
    !!me &&
    me.role !== 'spectator' &&
    ((room.turn === 'w' && me.role === 'white') ||
      (room.turn === 'b' && me.role === 'black'));

  const media = useWebRtc({
    roomCode: room?.code ?? null,
    localPlayerId: playerId,
    remotePlayerId: opponent?.id ?? null,
    enabled: !!room && !!opponent && me?.role !== 'spectator',
  });

  useEffect(() => {
    const offState = onRoomState((r) => setRoom(r));
    const offChat = onChatMessage((m) => setMessages((prev) => [...prev, m]));
    const offHist = onChatHistory((msgs) => setMessages(msgs));
    const offErr = onRoomError((p) => setError(p.error));
    return () => {
      offState();
      offChat();
      offHist();
      offErr();
    };
  }, []);

  // Auto-reconnect from session
  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    if (routeCode && session.roomCode !== routeCode.toUpperCase()) return;
    if (room) return;

    void (async () => {
      const res = await joinRoom({
        nickname: session.nickname,
        roomCode: session.roomCode,
        playerId: session.playerId,
      });
      if (!res.ok) return;
      setPlayerId(res.playerId);
      setRoom(res.room);
      setNickname(session.nickname);
      saveSession({
        roomCode: res.room.code,
        playerId: res.playerId,
        nickname: session.nickname,
      });
      if (!routeCode) navigate(`/room/${res.room.code}`, { replace: true });
    })();
  }, [navigate, room, routeCode]);

  const persistNick = (value: string) => {
    setNickname(value);
    localStorage.setItem('xadrez3d.nickname', value);
  };

  const enterCreated = async (e: FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return setError('Informe um nickname');
    setBusy(true);
    setError(null);
    const res = await createRoom({ nickname: nickname.trim(), hostColor: 'w' });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setPlayerId(res.playerId);
    setRoom(res.room);
    saveSession({
      roomCode: res.room.code,
      playerId: res.playerId,
      nickname: nickname.trim(),
    });
    navigate(`/room/${res.room.code}`);
  };

  const enterJoined = async (e: FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !joinCode.trim()) {
      return setError('Nickname e código são obrigatórios');
    }
    setBusy(true);
    setError(null);
    const res = await joinRoom({
      nickname: nickname.trim(),
      roomCode: joinCode.trim().toUpperCase(),
      asSpectator,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setPlayerId(res.playerId);
    setRoom(res.room);
    saveSession({
      roomCode: res.room.code,
      playerId: res.playerId,
      nickname: nickname.trim(),
    });
    navigate(`/room/${res.room.code}`);
  };

  const onSquareClick = async (square: string) => {
    if (!canMove || !room) return;
    if (selected) {
      const legal = getLegalTargets(room.fen, selected);
      if (legal.includes(square)) {
        const game = new Chess(room.fen);
        const piece = game.get(selected as 'a1');
        const promo =
          piece?.type === 'p' &&
          ((piece.color === 'w' && square[1] === '8') ||
            (piece.color === 'b' && square[1] === '1'))
            ? 'q'
            : undefined;
        const res = await sendMove({ from: selected, to: square, promotion: promo });
        setSelected(null);
        if (!res.ok) setError(res.error);
        return;
      }
    }
    const game = new Chess(room.fen);
    const piece = game.get(square as 'a1');
    if (piece && ((piece.color === 'w' && me?.role === 'white') || (piece.color === 'b' && me?.role === 'black'))) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  };

  const onLeave = () => {
    leaveRoom();
    clearSession();
    setRoom(null);
    setPlayerId(null);
    setMessages([]);
    navigate('/room');
  };

  if (!room) {
    return (
      <Shell>
        <section className="home-grid fade-rise">
          <form className="panel home-card" onSubmit={enterCreated}>
            <h2>Criar sala</h2>
            <label>
              Nickname
              <input
                value={nickname}
                onChange={(e) => persistNick(e.target.value)}
                maxLength={24}
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              Criar
            </button>
          </form>
          <form className="panel home-card" onSubmit={enterJoined}>
            <h2>Entrar</h2>
            <label>
              Nickname
              <input
                value={nickname}
                onChange={(e) => persistNick(e.target.value)}
                maxLength={24}
                required
              />
            </label>
            <label>
              Código
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                required
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={asSpectator}
                onChange={(e) => setAsSpectator(e.target.checked)}
              />
              Entrar como espectador
            </label>
            <button type="submit" disabled={busy}>
              Entrar
            </button>
          </form>
        </section>
        {error && <p className="form-error center">{error}</p>}
      </Shell>
    );
  }

  const endLabel =
    room.status === 'finished'
      ? `Fim: ${room.result}${room.endReason ? ` (${room.endReason})` : ''}`
      : room.status === 'waiting'
        ? 'Aguardando oponente…'
        : canMove
          ? 'Sua vez'
          : 'Vez do oponente';

  return (
    <Shell wide>
      <div className="mp-layout fade-rise">
        <aside className="panel side-panel">
          <h2>
            Sala <span className="room-code">{room.code}</span>
          </h2>
          <p className="muted">
            Você: {me?.nickname} ({me?.role})
          </p>
          <ul className="player-list">
            {room.players.map((p) => (
              <li key={p.id}>
                <span>
                  {p.nickname} · {p.role}
                </span>
                <span className={p.connected ? 'ok' : 'bad'}>
                  {p.connected ? 'online' : 'offline'}
                </span>
              </li>
            ))}
          </ul>
          <div className="clocks">
            <div className={room.turn === 'b' && room.status === 'playing' ? 'clock active' : 'clock'}>
              <span>Pretas</span>
              <strong>{formatClock(room.clocks.blackMs)}</strong>
            </div>
            <div className={room.turn === 'w' && room.status === 'playing' ? 'clock active' : 'clock'}>
              <span>Brancas</span>
              <strong>{formatClock(room.clocks.whiteMs)}</strong>
            </div>
          </div>
          <p>{endLabel}</p>
          {room.drawOfferedBy && room.drawOfferedBy !== playerId && me?.role !== 'spectator' && (
            <div className="draw-offer">
              <p>Empate oferecido</p>
              <button type="button" onClick={() => respondDraw(true)}>
                Aceitar
              </button>
              <button type="button" className="ghost" onClick={() => respondDraw(false)}>
                Recusar
              </button>
            </div>
          )}
          <div className="action-row">
            {me?.role !== 'spectator' && room.status === 'playing' && (
              <>
                <button type="button" className="ghost" onClick={() => offerDraw()}>
                  Empate
                </button>
                <button type="button" className="danger" onClick={() => resignGame()}>
                  Desistir
                </button>
              </>
            )}
            <button type="button" className="ghost" onClick={onLeave}>
              Sair
            </button>
          </div>
          <div className="move-list">
            {room.moveHistory.map((m, i) => (
              <span key={`${m}-${i}`}>{m}</span>
            ))}
          </div>
          <Link to="/ranking">Ranking</Link>
          {error && <p className="form-error">{error}</p>}
        </aside>

        <ChessBoardCanvas
          fen={room.fen}
          orientation={orientation}
          interactive={canMove}
          selected={selected}
          lastMove={room.lastMove}
          onSquareClick={onSquareClick}
        />

        <div className="mp-side">
          <ChatPanel
            messages={messages}
            onSend={async (text) => {
              const res = await sendChat(text);
              if (!res.ok) throw new Error(res.error);
            }}
          />
          {me?.role !== 'spectator' && (
            <MediaPanel
              localStream={media.localStream}
              remoteStream={media.remoteStream}
              micOn={media.micOn}
              camOn={media.camOn}
              onToggleMic={media.toggleMic}
              onToggleCam={media.toggleCam}
              remoteNickname={opponent?.nickname}
            />
          )}
        </div>
      </div>
    </Shell>
  );
}
