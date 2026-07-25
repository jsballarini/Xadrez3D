import { Chess, type Move } from 'chess.js';

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

const PST: Record<string, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10,
    25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10,
    10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0,
    -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5,
    -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
    0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5,
    0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5,
    0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0,
    -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50,
    -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

/**
 * Local chess engine with alpha-beta search.
 * Used as primary AI (reliable in Vite) with optional Stockfish worker upgrade.
 */
export class LocalEngine {
  async getBestMove(fen: string, level: number): Promise<string | null> {
    const depth = Math.max(1, Math.min(4, Math.ceil(level / 3)));
    const game = new Chess(fen);
    const maximizing = game.turn() === 'w';
    const moves = shuffle(game.moves({ verbose: true }));
    if (moves.length === 0) return null;

    let best: Move | null = null;
    let bestScore = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
      game.move(move);
      const score = alphabeta(game, depth - 1, -Infinity, Infinity, !maximizing);
      game.undo();
      if (maximizing ? score > bestScore : score < bestScore) {
        bestScore = score;
        best = move;
      }
      // Soften strength on low levels
      if (level <= 3 && Math.random() < 0.25) {
        best = move;
        break;
      }
    }

    if (!best) return null;
    return `${best.from}${best.to}${best.promotion || ''}`;
  }
}

function alphabeta(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  if (depth === 0 || game.isGameOver()) return evaluate(game);

  const moves = game.moves({ verbose: true });
  if (maximizing) {
    let value = -Infinity;
    for (const move of moves) {
      game.move(move);
      value = Math.max(value, alphabeta(game, depth - 1, alpha, beta, false));
      game.undo();
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Infinity;
  for (const move of moves) {
    game.move(move);
    value = Math.min(value, alphabeta(game, depth - 1, alpha, beta, true));
    game.undo();
    beta = Math.min(beta, value);
    if (beta <= alpha) break;
  }
  return value;
}

function evaluate(game: Chess): number {
  if (game.isCheckmate()) return game.turn() === 'w' ? -100000 : 100000;
  if (game.isDraw()) return 0;

  let score = 0;
  const board = game.board();
  for (let r = 0; r < 8; r += 1) {
    for (let f = 0; f < 8; f += 1) {
      const cell = board[r]?.[f];
      if (!cell) continue;
      const idx = cell.color === 'w' ? r * 8 + f : (7 - r) * 8 + f;
      const pst = PST[cell.type]?.[idx] ?? 0;
      const val = (PIECE_VALUE[cell.type] ?? 0) + pst;
      score += cell.color === 'w' ? val : -val;
    }
  }
  return score;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function uciToMove(uci: string): {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
} | null {
  if (!uci || uci.length < 4) return null;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promo = uci[4] as 'q' | 'r' | 'b' | 'n' | undefined;
  return { from, to, promotion: promo };
}

/** Optional Stockfish worker if /stockfish.js is present in public/. */
export class StockfishEngine {
  private worker: Worker | null = null;
  private ready = false;
  private pending: ((bestMove: string) => void) | null = null;
  private local = new LocalEngine();

  async init(): Promise<void> {
    if (this.worker || this.ready) return;
    try {
      this.worker = new Worker('/stockfish.js');
      this.worker.onmessage = (e: MessageEvent<string>) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data);
        if (line === 'uciok' || line.startsWith('readyok')) this.ready = true;
        if (line.startsWith('bestmove')) {
          const move = line.split(/\s+/)[1];
          if (move && move !== '(none)' && this.pending) {
            this.pending(move);
            this.pending = null;
          }
        }
      };
      this.worker.onerror = () => {
        this.worker = null;
        this.ready = true;
      };
      this.worker.postMessage('uci');
      await delay(400);
      this.ready = true;
    } catch {
      this.worker = null;
      this.ready = true;
    }
  }

  async getBestMove(fen: string, level: number, movetime = 600): Promise<string | null> {
    await this.init();
    if (!this.worker) return this.local.getBestMove(fen, level);

    const skill = Math.max(0, Math.min(20, Math.round(((level - 1) / 9) * 20)));
    return new Promise((resolve) => {
      this.pending = (best) => resolve(best);
      this.worker?.postMessage(`setoption name Skill Level value ${skill}`);
      this.worker?.postMessage('ucinewgame');
      this.worker?.postMessage(`position fen ${fen}`);
      this.worker?.postMessage(`go movetime ${movetime}`);
      setTimeout(async () => {
        if (this.pending) {
          this.pending = null;
          resolve(await this.local.getBestMove(fen, level));
        }
      }, movetime + 2000);
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
