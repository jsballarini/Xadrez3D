import type { Server, Socket } from 'socket.io';
import {
  SocketEvents,
  type CreateRoomPayload,
  type IceServersPayload,
  type JoinRoomPayload,
  type MovePayload,
  type WebRtcSignalPayload,
} from '@xadrez3d/shared';
import type { RankingStore } from './ranking.js';
import type { RoomManager } from './rooms.js';

export function registerSocketHandlers(
  io: Server,
  rooms: RoomManager,
  ranking: RankingStore,
  iceServers: IceServersPayload['iceServers'],
): void {
  io.on('connection', (socket: Socket) => {
    socket.emit(SocketEvents.ICE_SERVERS, { iceServers } satisfies IceServersPayload);

    socket.on(SocketEvents.ROOM_CREATE, (payload: CreateRoomPayload, ack?: Function) => {
      try {
        const result = rooms.create(payload, socket.id);
        socket.join(result.room.code);
        socket.data.roomCode = result.room.code;
        socket.data.playerId = result.playerId;
        ack?.({ ok: true, ...result });
        io.to(result.room.code).emit(SocketEvents.ROOM_STATE, result.room);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar sala';
        ack?.({ ok: false, error: message });
        socket.emit(SocketEvents.ROOM_ERROR, { error: message });
      }
    });

    socket.on(SocketEvents.ROOM_JOIN, (payload: JoinRoomPayload, ack?: Function) => {
      try {
        const result = rooms.join(payload, socket.id);
        socket.join(result.room.code);
        socket.data.roomCode = result.room.code;
        socket.data.playerId = result.playerId;
        ack?.({ ok: true, ...result });
        io.to(result.room.code).emit(SocketEvents.ROOM_STATE, result.room);
        socket.emit(SocketEvents.CHAT_HISTORY, rooms.getChat(result.room.code));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao entrar na sala';
        ack?.({ ok: false, error: message });
        socket.emit(SocketEvents.ROOM_ERROR, { error: message });
      }
    });

    socket.on(SocketEvents.ROOM_LEAVE, () => {
      handleLeave(io, rooms, socket);
    });

    socket.on(SocketEvents.PLAYER_READY, () => {
      try {
        const { roomCode, playerId } = requireSession(socket);
        const state = rooms.setReady(roomCode, playerId);
        io.to(roomCode).emit(SocketEvents.ROOM_STATE, state);
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on(SocketEvents.GAME_MOVE, (move: MovePayload, ack?: Function) => {
      try {
        const { roomCode, playerId } = requireSession(socket);
        const state = rooms.move(roomCode, playerId, move);
        io.to(roomCode).emit(SocketEvents.ROOM_STATE, state);
        if (state.status === 'finished') {
          applyRanking(io, rooms, ranking, roomCode, state);
        }
        ack?.({ ok: true, room: state });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Lance inválido';
        ack?.({ ok: false, error: message });
        emitError(socket, err);
      }
    });

    socket.on(SocketEvents.GAME_RESIGN, () => {
      try {
        const { roomCode, playerId } = requireSession(socket);
        const state = rooms.resign(roomCode, playerId);
        io.to(roomCode).emit(SocketEvents.ROOM_STATE, state);
        applyRanking(io, rooms, ranking, roomCode, state);
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on(SocketEvents.GAME_OFFER_DRAW, () => {
      try {
        const { roomCode, playerId } = requireSession(socket);
        const state = rooms.offerDraw(roomCode, playerId);
        io.to(roomCode).emit(SocketEvents.ROOM_STATE, state);
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on(
      SocketEvents.GAME_DRAW_RESPONSE,
      (payload: { accept: boolean }) => {
        try {
          const { roomCode, playerId } = requireSession(socket);
          const state = rooms.respondDraw(roomCode, playerId, payload.accept);
          io.to(roomCode).emit(SocketEvents.ROOM_STATE, state);
          if (state.status === 'finished') {
            applyRanking(io, rooms, ranking, roomCode, state);
          }
        } catch (err) {
          emitError(socket, err);
        }
      },
    );

    socket.on(SocketEvents.CHAT_MESSAGE, (payload: { text: string }, ack?: Function) => {
      try {
        const { roomCode, playerId } = requireSession(socket);
        const message = rooms.addChat(roomCode, playerId, payload.text);
        io.to(roomCode).emit(SocketEvents.CHAT_MESSAGE, message);
        ack?.({ ok: true, message });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro no chat';
        ack?.({ ok: false, error: message });
      }
    });

    socket.on(SocketEvents.WEBRTC_SIGNAL, (payload: WebRtcSignalPayload) => {
      try {
        const targetSocketId = rooms.getPlayerSocket(payload.roomCode, payload.toPlayerId);
        if (!targetSocketId) return;
        io.to(targetSocketId).emit(SocketEvents.WEBRTC_SIGNAL, {
          ...payload,
          fromPlayerId: socket.data.playerId,
        });
      } catch {
        // ignore signaling errors
      }
    });

    socket.on('disconnect', () => {
      handleLeave(io, rooms, socket);
    });
  });

  setInterval(() => {
    for (const update of rooms.tickAll()) {
      io.to(update.code).emit(SocketEvents.ROOM_STATE, update.state);
      if (update.finished) {
        applyRanking(io, rooms, ranking, update.code, update.state);
      }
    }
  }, 1000);
}

function requireSession(socket: Socket): { roomCode: string; playerId: string } {
  const roomCode = socket.data.roomCode as string | undefined;
  const playerId = socket.data.playerId as string | undefined;
  if (!roomCode || !playerId) throw new Error('Sessão inválida');
  return { roomCode, playerId };
}

function handleLeave(io: Server, rooms: RoomManager, socket: Socket): void {
  const result = rooms.leave(socket.id);
  if (!result) return;
  socket.leave(result.roomCode);
  io.to(result.roomCode).emit(SocketEvents.PLAYER_DISCONNECTED, {
    playerId: result.playerId,
    room: result.room,
  });
  io.to(result.roomCode).emit(SocketEvents.ROOM_STATE, result.room);
  socket.data.roomCode = undefined;
  socket.data.playerId = undefined;
}

function emitError(socket: Socket, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Erro';
  socket.emit(SocketEvents.ROOM_ERROR, { error: message });
}

function applyRanking(
  io: Server,
  rooms: RoomManager,
  ranking: RankingStore,
  roomCode: string,
  state: { result: string; endReason: string | null },
): void {
  const match = rooms.consumeRanked(roomCode);
  if (!match) return;
  ranking.recordMatch(match.white, match.black, match.result);
  const room = rooms.getRoom(roomCode);
  if (!room) return;
  io.to(roomCode).emit(SocketEvents.GAME_OVER, {
    result: state.result,
    reason: state.endReason ?? 'draw',
    room,
  });
}
