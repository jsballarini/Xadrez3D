import { randomUUID } from 'node:crypto';
import {
  applyMove,
  CHAT_HISTORY_LIMIT,
  CHAT_MAX_LENGTH,
  CHAT_RATE_LIMIT_MS,
  DEFAULT_INCREMENT_MS,
  DEFAULT_TIME_CONTROL_MS,
  evaluateGameEnd,
  generateRoomCode,
  STARTING_FEN,
  type ChatMessage,
  type CreateRoomPayload,
  type GameEndReason,
  type GameResult,
  type JoinRoomPayload,
  type MovePayload,
  type PlayerInfo,
  type PlayerRole,
  type RoomState,
} from '@xadrez3d/shared';

interface InternalRoom {
  state: RoomState;
  chat: ChatMessage[];
  lastChatAt: Map<string, number>;
  sockets: Map<string, string>; // playerId -> socketId
  ranked: boolean;
}

export class RoomManager {
  private rooms = new Map<string, InternalRoom>();

  create(payload: CreateRoomPayload, socketId: string): { playerId: string; room: RoomState } {
    const nickname = sanitizeNickname(payload.nickname);
    if (!nickname) throw new Error('Nickname inválido');

    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();

    const playerId = randomUUID();
    const hostColor = payload.hostColor ?? 'w';
    const role: PlayerRole = hostColor === 'w' ? 'white' : 'black';
    const timeControlMs = payload.timeControlMs ?? DEFAULT_TIME_CONTROL_MS;
    const incrementMs = payload.incrementMs ?? DEFAULT_INCREMENT_MS;

    const player: PlayerInfo = {
      id: playerId,
      nickname,
      role,
      connected: true,
      ready: false,
    };

    const state: RoomState = {
      code,
      fen: STARTING_FEN,
      turn: 'w',
      players: [player],
      status: 'waiting',
      result: '*',
      endReason: null,
      clocks: {
        whiteMs: timeControlMs,
        blackMs: timeControlMs,
        activeColor: null,
        lastTickAt: null,
        incrementMs,
      },
      settings: {
        timeControlMs,
        incrementMs,
        hostColor,
      },
      drawOfferedBy: null,
      lastMove: null,
      moveHistory: [],
    };

    const room: InternalRoom = {
      state,
      chat: [],
      lastChatAt: new Map(),
      sockets: new Map([[playerId, socketId]]),
      ranked: false,
    };
    this.rooms.set(code, room);
    return { playerId, room: cloneState(state) };
  }

  join(
    payload: JoinRoomPayload,
    socketId: string,
  ): { playerId: string; room: RoomState } {
    const code = payload.roomCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) throw new Error('Sala não encontrada');

    // Reconnect
    if (payload.playerId) {
      const existing = room.state.players.find((p) => p.id === payload.playerId);
      if (existing) {
        existing.connected = true;
        room.sockets.set(existing.id, socketId);
        this.tickClocks(room);
        return { playerId: existing.id, room: cloneState(room.state) };
      }
    }

    const nickname = sanitizeNickname(payload.nickname);
    if (!nickname) throw new Error('Nickname inválido');

    const playerId = randomUUID();
    let role: PlayerRole = 'spectator';

    if (!payload.asSpectator) {
      const hasWhite = room.state.players.some((p) => p.role === 'white');
      const hasBlack = room.state.players.some((p) => p.role === 'black');
      if (!hasWhite) role = 'white';
      else if (!hasBlack) role = 'black';
      else role = 'spectator';
    }

    const player: PlayerInfo = {
      id: playerId,
      nickname,
      role,
      connected: true,
      ready: false,
    };
    room.state.players.push(player);
    room.sockets.set(playerId, socketId);

    if (
      room.state.status === 'waiting' &&
      room.state.players.some((p) => p.role === 'white') &&
      room.state.players.some((p) => p.role === 'black')
    ) {
      // Auto-start when both seats filled
      this.maybeStart(room);
    }

    return { playerId, room: cloneState(room.state) };
  }

  leave(socketId: string): { roomCode: string; room: RoomState; playerId: string } | null {
    for (const [code, room] of this.rooms) {
      for (const [playerId, sid] of room.sockets) {
        if (sid !== socketId) continue;
        room.sockets.delete(playerId);
        const player = room.state.players.find((p) => p.id === playerId);
        if (player) player.connected = false;

        if (room.state.status === 'waiting') {
          room.state.players = room.state.players.filter((p) => p.id !== playerId);
        }

        if (room.state.players.every((p) => !p.connected) && room.sockets.size === 0) {
          this.rooms.delete(code);
        }

        return { roomCode: code, room: cloneState(room.state), playerId };
      }
    }
    return null;
  }

  setReady(roomCode: string, playerId: string): RoomState {
    const room = this.requireRoom(roomCode);
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player || player.role === 'spectator') throw new Error('Jogador inválido');
    player.ready = true;
    this.maybeStart(room);
    return cloneState(room.state);
  }

  move(roomCode: string, playerId: string, move: MovePayload): RoomState {
    const room = this.requireRoom(roomCode);
    this.tickClocks(room);

    if (room.state.status !== 'playing') throw new Error('Partida não está em andamento');
    if (this.isTimedOut(room)) {
      return cloneState(room.state);
    }

    const player = room.state.players.find((p) => p.id === playerId);
    if (!player || player.role === 'spectator') throw new Error('Sem permissão');

    const expectedRole: PlayerRole = room.state.turn === 'w' ? 'white' : 'black';
    if (player.role !== expectedRole) throw new Error('Não é sua vez');

    const applied = applyMove(room.state.fen, move);
    if (!applied) throw new Error('Lance inválido');

    // Increment for the player who just moved
    if (room.state.clocks.incrementMs > 0) {
      if (expectedRole === 'white') room.state.clocks.whiteMs += room.state.clocks.incrementMs;
      else room.state.clocks.blackMs += room.state.clocks.incrementMs;
    }

    room.state.fen = applied.fen;
    room.state.turn = applied.fen.includes(' w ') ? 'w' : 'b';
    room.state.lastMove = { from: applied.from, to: applied.to, san: applied.san };
    room.state.moveHistory.push(applied.san);
    room.state.drawOfferedBy = null;
    room.state.clocks.activeColor = room.state.turn;
    room.state.clocks.lastTickAt = Date.now();

    const end = evaluateGameEnd(room.state.fen);
    if (end.over && end.reason) {
      this.finish(room, end.result, end.reason);
    }

    return cloneState(room.state);
  }

  resign(roomCode: string, playerId: string): RoomState {
    const room = this.requireRoom(roomCode);
    if (room.state.status !== 'playing') throw new Error('Partida não está em andamento');
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player || player.role === 'spectator') throw new Error('Sem permissão');
    const result: GameResult = player.role === 'white' ? '0-1' : '1-0';
    this.finish(room, result, 'resign');
    return cloneState(room.state);
  }

  offerDraw(roomCode: string, playerId: string): RoomState {
    const room = this.requireRoom(roomCode);
    if (room.state.status !== 'playing') throw new Error('Partida não está em andamento');
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player || player.role === 'spectator') throw new Error('Sem permissão');
    room.state.drawOfferedBy = playerId;
    return cloneState(room.state);
  }

  respondDraw(roomCode: string, playerId: string, accept: boolean): RoomState {
    const room = this.requireRoom(roomCode);
    if (room.state.status !== 'playing') throw new Error('Partida não está em andamento');
    if (!room.state.drawOfferedBy) throw new Error('Nenhuma oferta de empate');
    if (room.state.drawOfferedBy === playerId) throw new Error('Não pode responder à própria oferta');

    const player = room.state.players.find((p) => p.id === playerId);
    if (!player || player.role === 'spectator') throw new Error('Sem permissão');

    if (accept) {
      this.finish(room, '1/2-1/2', 'agreement');
    } else {
      room.state.drawOfferedBy = null;
    }
    return cloneState(room.state);
  }

  addChat(roomCode: string, playerId: string, text: string): ChatMessage {
    const room = this.requireRoom(roomCode);
    const player = room.state.players.find((p) => p.id === playerId);
    if (!player) throw new Error('Jogador não encontrado');

    const cleaned = text.trim().slice(0, CHAT_MAX_LENGTH);
    if (!cleaned) throw new Error('Mensagem vazia');

    const now = Date.now();
    const last = room.lastChatAt.get(playerId) ?? 0;
    if (now - last < CHAT_RATE_LIMIT_MS) throw new Error('Aguarde antes de enviar outra mensagem');
    room.lastChatAt.set(playerId, now);

    const message: ChatMessage = {
      id: randomUUID(),
      roomCode: room.state.code,
      playerId,
      nickname: player.nickname,
      text: cleaned,
      timestamp: now,
    };
    room.chat.push(message);
    if (room.chat.length > CHAT_HISTORY_LIMIT) {
      room.chat.splice(0, room.chat.length - CHAT_HISTORY_LIMIT);
    }
    return message;
  }

  getChat(roomCode: string): ChatMessage[] {
    return [...this.requireRoom(roomCode).chat];
  }

  getRoom(roomCode: string): RoomState | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) return null;
    this.tickClocks(room);
    return cloneState(room.state);
  }

  getPlayerSocket(roomCode: string, playerId: string): string | undefined {
    return this.rooms.get(roomCode.toUpperCase())?.sockets.get(playerId);
  }

  getRoomPlayers(roomCode: string): PlayerInfo[] {
    return this.requireRoom(roomCode).state.players;
  }

  consumeRanked(roomCode: string): {
    white: string;
    black: string;
    result: '1-0' | '0-1' | '1/2-1/2';
  } | null {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room || room.ranked) return null;
    if (room.state.status !== 'finished') return null;
    if (room.state.result === '*') return null;

    const white = room.state.players.find((p) => p.role === 'white');
    const black = room.state.players.find((p) => p.role === 'black');
    if (!white || !black) return null;

    room.ranked = true;
    return {
      white: white.nickname,
      black: black.nickname,
      result: room.state.result,
    };
  }

  tickAll(): Array<{ code: string; state: RoomState; finished: boolean }> {
    const updates: Array<{ code: string; state: RoomState; finished: boolean }> = [];
    for (const [code, room] of this.rooms) {
      if (room.state.status !== 'playing') continue;
      this.tickClocks(room);
      updates.push({
        code,
        state: cloneState(room.state),
        finished: room.state.status !== 'playing',
      });
    }
    return updates;
  }

  private maybeStart(room: InternalRoom): void {
    const white = room.state.players.find((p) => p.role === 'white' && p.connected);
    const black = room.state.players.find((p) => p.role === 'black' && p.connected);
    if (!white || !black) return;
    if (room.state.status !== 'waiting') return;

    room.state.status = 'playing';
    room.state.clocks.activeColor = 'w';
    room.state.clocks.lastTickAt = Date.now();
    white.ready = true;
    black.ready = true;
  }

  private tickClocks(room: InternalRoom): void {
    if (room.state.status !== 'playing') return;
    if (!room.state.clocks.activeColor || !room.state.clocks.lastTickAt) return;

    const now = Date.now();
    const elapsed = now - room.state.clocks.lastTickAt;
    room.state.clocks.lastTickAt = now;

    if (room.state.clocks.activeColor === 'w') {
      room.state.clocks.whiteMs = Math.max(0, room.state.clocks.whiteMs - elapsed);
    } else {
      room.state.clocks.blackMs = Math.max(0, room.state.clocks.blackMs - elapsed);
    }

    this.isTimedOut(room);
  }

  private isTimedOut(room: InternalRoom): boolean {
    if (room.state.clocks.whiteMs <= 0) {
      this.finish(room, '0-1', 'timeout');
      return true;
    }
    if (room.state.clocks.blackMs <= 0) {
      this.finish(room, '1-0', 'timeout');
      return true;
    }
    return false;
  }

  private finish(room: InternalRoom, result: GameResult, reason: GameEndReason): void {
    room.state.status = 'finished';
    room.state.result = result;
    room.state.endReason = reason;
    room.state.clocks.activeColor = null;
    room.state.clocks.lastTickAt = null;
    room.state.drawOfferedBy = null;
  }

  private requireRoom(code: string): InternalRoom {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error('Sala não encontrada');
    return room;
  }
}

function sanitizeNickname(raw: string): string {
  return raw.trim().slice(0, 24).replace(/[<>]/g, '');
}

function cloneState(state: RoomState): RoomState {
  return structuredClone(state);
}
