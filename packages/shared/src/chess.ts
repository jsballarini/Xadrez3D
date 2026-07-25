import { Chess, type Square } from 'chess.js';
import type { GameEndReason, GameResult, MovePayload, PieceColor } from './types.js';

export const STARTING_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function createGame(fen: string = STARTING_FEN): Chess {
  return new Chess(fen);
}

export function getTurn(fen: string): PieceColor {
  return createGame(fen).turn();
}

export function isValidMove(fen: string, move: MovePayload): boolean {
  const game = createGame(fen);
  try {
    const result = game.move({
      from: move.from as Square,
      to: move.to as Square,
      promotion: move.promotion,
    });
    return result !== null;
  } catch {
    return false;
  }
}

export function applyMove(fen: string, move: MovePayload): {
  fen: string;
  san: string;
  from: string;
  to: string;
} | null {
  const game = createGame(fen);
  try {
    const result = game.move({
      from: move.from as Square,
      to: move.to as Square,
      promotion: move.promotion,
    });
    if (!result) return null;
    return {
      fen: game.fen(),
      san: result.san,
      from: result.from,
      to: result.to,
    };
  } catch {
    return null;
  }
}

export function getLegalMoves(fen: string, from?: string): Array<{ from: string; to: string; promotion?: string }> {
  const game = createGame(fen);
  const moves = from
    ? game.moves({ square: from as Square, verbose: true })
    : game.moves({ verbose: true });

  return moves.map((m) => ({
    from: m.from,
    to: m.to,
    promotion: m.promotion,
  }));
}

export function evaluateGameEnd(fen: string): {
  over: boolean;
  result: GameResult;
  reason: GameEndReason | null;
} {
  const game = createGame(fen);

  if (game.isCheckmate()) {
    return {
      over: true,
      result: game.turn() === 'w' ? '0-1' : '1-0',
      reason: 'checkmate',
    };
  }
  if (game.isStalemate()) {
    return { over: true, result: '1/2-1/2', reason: 'stalemate' };
  }
  if (game.isDraw() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
    return { over: true, result: '1/2-1/2', reason: 'draw' };
  }
  return { over: false, result: '*', reason: null };
}

export function filesRanks(): { files: string[]; ranks: string[] } {
  return {
    files: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    ranks: ['1', '2', '3', '4', '5', '6', '7', '8'],
  };
}

export function squareToCoords(square: string): { file: number; rank: number } {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]) - 1;
  return { file, rank };
}

export function coordsToSquare(file: number, rank: number): string {
  return `${String.fromCharCode('a'.charCodeAt(0) + file)}${rank + 1}`;
}

export function generateRoomCode(length = 4): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export const DEFAULT_TIME_CONTROL_MS = 10 * 60 * 1000;
export const DEFAULT_INCREMENT_MS = 0;
export const CHAT_MAX_LENGTH = 300;
export const CHAT_RATE_LIMIT_MS = 800;
export const CHAT_HISTORY_LIMIT = 100;
export const INITIAL_ELO = 1200;
export const ELO_K = 32;
