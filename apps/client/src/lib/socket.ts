import { io, type Socket } from 'socket.io-client';
import {
  SocketEvents,
  type ChatMessage,
  type CreateRoomPayload,
  type IceServersPayload,
  type JoinRoomPayload,
  type MovePayload,
  type RoomState,
  type WebRtcSignalPayload,
} from '@xadrez3d/shared';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL ?? '/', {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export type RoomAck<T> = { ok: true } & T | { ok: false; error: string };

export function createRoom(payload: CreateRoomPayload): Promise<RoomAck<{ playerId: string; room: RoomState }>> {
  return emitAck(SocketEvents.ROOM_CREATE, payload);
}

export function joinRoom(payload: JoinRoomPayload): Promise<RoomAck<{ playerId: string; room: RoomState }>> {
  return emitAck(SocketEvents.ROOM_JOIN, payload);
}

export function sendMove(move: MovePayload): Promise<RoomAck<{ room: RoomState }>> {
  return emitAck(SocketEvents.GAME_MOVE, move);
}

export function resignGame(): void {
  getSocket().emit(SocketEvents.GAME_RESIGN);
}

export function offerDraw(): void {
  getSocket().emit(SocketEvents.GAME_OFFER_DRAW);
}

export function respondDraw(accept: boolean): void {
  getSocket().emit(SocketEvents.GAME_DRAW_RESPONSE, { accept });
}

export function sendChat(text: string): Promise<RoomAck<{ message: ChatMessage }>> {
  return emitAck(SocketEvents.CHAT_MESSAGE, { text });
}

export function leaveRoom(): void {
  getSocket().emit(SocketEvents.ROOM_LEAVE);
}

export function sendWebRtcSignal(payload: WebRtcSignalPayload): void {
  getSocket().emit(SocketEvents.WEBRTC_SIGNAL, payload);
}

export function onRoomState(handler: (room: RoomState) => void): () => void {
  const s = getSocket();
  s.on(SocketEvents.ROOM_STATE, handler);
  return () => s.off(SocketEvents.ROOM_STATE, handler);
}

export function onChatMessage(handler: (msg: ChatMessage) => void): () => void {
  const s = getSocket();
  s.on(SocketEvents.CHAT_MESSAGE, handler);
  return () => s.off(SocketEvents.CHAT_MESSAGE, handler);
}

export function onChatHistory(handler: (msgs: ChatMessage[]) => void): () => void {
  const s = getSocket();
  s.on(SocketEvents.CHAT_HISTORY, handler);
  return () => s.off(SocketEvents.CHAT_HISTORY, handler);
}

export function onWebRtcSignal(handler: (payload: WebRtcSignalPayload) => void): () => void {
  const s = getSocket();
  s.on(SocketEvents.WEBRTC_SIGNAL, handler);
  return () => s.off(SocketEvents.WEBRTC_SIGNAL, handler);
}

export function onIceServers(handler: (payload: IceServersPayload) => void): () => void {
  const s = getSocket();
  s.on(SocketEvents.ICE_SERVERS, handler);
  return () => s.off(SocketEvents.ICE_SERVERS, handler);
}

export function onRoomError(handler: (payload: { error: string }) => void): () => void {
  const s = getSocket();
  s.on(SocketEvents.ROOM_ERROR, handler);
  return () => s.off(SocketEvents.ROOM_ERROR, handler);
}

function emitAck<T>(event: string, payload: unknown): Promise<RoomAck<T>> {
  return new Promise((resolve) => {
    getSocket().timeout(8000).emit(event, payload, (err: Error | null, res: RoomAck<T>) => {
      if (err) resolve({ ok: false, error: err.message || 'Timeout' });
      else resolve(res);
    });
  });
}

export const SESSION_KEY = 'xadrez3d.session';

export interface SessionData {
  roomCode: string;
  playerId: string;
  nickname: string;
}

export function saveSession(data: SessionData): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function loadSession(): SessionData | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
