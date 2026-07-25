import { Chess, type Square } from 'chess.js';
import type { MovePayload, PieceColor } from '@xadrez3d/shared';

export type BoardPiece = {
  square: string;
  type: string;
  color: PieceColor;
};

export function fenToPieces(fen: string): BoardPiece[] {
  const game = new Chess(fen);
  const pieces: BoardPiece[] = [];
  const board = game.board();
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const cell = board[rank]?.[file];
      if (!cell) continue;
      const square = `${String.fromCharCode(97 + file)}${8 - rank}`;
      pieces.push({ square, type: cell.type, color: cell.color });
    }
  }
  return pieces;
}

export function getLegalTargets(fen: string, from: string): string[] {
  const game = new Chess(fen);
  return game
    .moves({ square: from as Square, verbose: true })
    .map((m) => m.to);
}

export function tryLocalMove(fen: string, move: MovePayload): {
  fen: string;
  san: string;
  from: string;
  to: string;
} | null {
  const game = new Chess(fen);
  try {
    const result = game.move({
      from: move.from as Square,
      to: move.to as Square,
      promotion: move.promotion,
    });
    if (!result) return null;
    return { fen: game.fen(), san: result.san, from: result.from, to: result.to };
  } catch {
    return null;
  }
}

export function gameStatus(fen: string): {
  over: boolean;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  reason: string | null;
} {
  const game = new Chess(fen);
  if (game.isCheckmate()) {
    return {
      over: true,
      result: game.turn() === 'w' ? '0-1' : '1-0',
      reason: 'Xeque-mate',
    };
  }
  if (game.isStalemate()) return { over: true, result: '1/2-1/2', reason: 'Afogamento' };
  if (game.isDraw()) return { over: true, result: '1/2-1/2', reason: 'Empate' };
  return { over: false, result: '*', reason: null };
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const PIECE_LABELS: Record<string, string> = {
  k: 'Rei',
  q: 'Dama',
  r: 'Torre',
  b: 'Bispo',
  n: 'Cavalo',
  p: 'Peão',
};
