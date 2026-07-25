export type PieceColor = 'w' | 'b';
export type PlayerRole = 'white' | 'black' | 'spectator';
export type GameMode = 'singleplayer' | 'multiplayer';
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';
export type GameEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'resign'
  | 'timeout'
  | 'agreement'
  | 'abort';

export interface PlayerInfo {
  id: string;
  nickname: string;
  role: PlayerRole;
  connected: boolean;
  ready: boolean;
}

export interface ChatMessage {
  id: string;
  roomCode: string;
  playerId: string;
  nickname: string;
  text: string;
  timestamp: number;
}

export interface ClockState {
  whiteMs: number;
  blackMs: number;
  activeColor: PieceColor | null;
  lastTickAt: number | null;
  incrementMs: number;
}

export interface RoomSettings {
  timeControlMs: number;
  incrementMs: number;
  hostColor: PieceColor;
}

export interface RoomState {
  code: string;
  fen: string;
  turn: PieceColor;
  players: PlayerInfo[];
  status: 'waiting' | 'playing' | 'finished';
  result: GameResult;
  endReason: GameEndReason | null;
  clocks: ClockState;
  settings: RoomSettings;
  drawOfferedBy: string | null;
  lastMove: { from: string; to: string; san: string } | null;
  moveHistory: string[];
}

export interface MovePayload {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface CreateRoomPayload {
  nickname: string;
  timeControlMs?: number;
  incrementMs?: number;
  hostColor?: PieceColor;
}

export interface JoinRoomPayload {
  nickname: string;
  roomCode: string;
  asSpectator?: boolean;
  playerId?: string;
}

export interface CreateRoomResponse {
  playerId: string;
  room: RoomState;
}

export interface JoinRoomResponse {
  playerId: string;
  room: RoomState;
}

export interface GameOverPayload {
  result: GameResult;
  reason: GameEndReason;
  room: RoomState;
}

export interface RankingEntry {
  nickname: string;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  updatedAt: string;
}

export interface WebRtcSignalPayload {
  roomCode: string;
  fromPlayerId: string;
  toPlayerId: string;
  signal: RTCSessionDescriptionInit | RTCIceCandidateInit;
  type: 'offer' | 'answer' | 'ice';
}

export interface IceServersPayload {
  iceServers: RTCIceServer[];
}

/** Minimal WebRTC types for shared package (DOM types may be absent on server). */
export interface RTCSessionDescriptionInit {
  type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface RTCIceCandidateInit {
  candidate?: string | null;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}
