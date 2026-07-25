import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyMove, evaluateGameEnd, isValidMove, STARTING_FEN, updateElo } from './index.js';

describe('chess helpers', () => {
  it('accepts e2e4 from start', () => {
    assert.equal(isValidMove(STARTING_FEN, { from: 'e2', to: 'e4' }), true);
    const applied = applyMove(STARTING_FEN, { from: 'e2', to: 'e4' });
    assert.ok(applied);
    assert.equal(applied.san, 'e4');
  });

  it('rejects illegal pawn jump', () => {
    assert.equal(isValidMove(STARTING_FEN, { from: 'e2', to: 'e5' }), false);
  });

  it('detects checkmate (fool mate setup reverse)', () => {
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    const end = evaluateGameEnd(fen);
    assert.equal(end.over, true);
    assert.equal(end.reason, 'checkmate');
  });
});

describe('elo', () => {
  it('updates ratings symmetrically on draw', () => {
    const { ratingA, ratingB } = updateElo(1200, 1200, 0.5);
    assert.equal(ratingA, 1200);
    assert.equal(ratingB, 1200);
  });
});
