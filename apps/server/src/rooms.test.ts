import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RoomManager } from './rooms.js';

describe('RoomManager', () => {
  it('creates and joins a room with white and black', () => {
    const rooms = new RoomManager();
    const created = rooms.create({ nickname: 'Alice', hostColor: 'w' }, 'sock-a');
    assert.equal(created.room.players[0]?.role, 'white');
    assert.ok(created.room.code.length === 4);

    const joined = rooms.join(
      { nickname: 'Bob', roomCode: created.room.code },
      'sock-b',
    );
    assert.equal(joined.room.players.find((p) => p.nickname === 'Bob')?.role, 'black');
    assert.equal(joined.room.status, 'playing');
  });

  it('validates moves and updates fen', () => {
    const rooms = new RoomManager();
    const created = rooms.create({ nickname: 'Alice', hostColor: 'w' }, 'sock-a');
    const joined = rooms.join(
      { nickname: 'Bob', roomCode: created.room.code },
      'sock-b',
    );

    const after = rooms.move(joined.room.code, created.playerId, {
      from: 'e2',
      to: 'e4',
    });
    assert.equal(after.turn, 'b');
    assert.equal(after.lastMove?.san, 'e4');
    assert.equal(after.moveHistory.length, 1);
  });

  it('rejects invalid moves', () => {
    const rooms = new RoomManager();
    const created = rooms.create({ nickname: 'Alice', hostColor: 'w' }, 'sock-a');
    rooms.join({ nickname: 'Bob', roomCode: created.room.code }, 'sock-b');

    assert.throws(() =>
      rooms.move(created.room.code, created.playerId, { from: 'e2', to: 'e5' }),
    );
  });

  it('rate-limits chat', () => {
    const rooms = new RoomManager();
    const created = rooms.create({ nickname: 'Alice' }, 'sock-a');
    rooms.addChat(created.room.code, created.playerId, 'oi');
    assert.throws(() => rooms.addChat(created.room.code, created.playerId, 'oi de novo'));
  });
});
