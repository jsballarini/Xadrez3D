import { ELO_K, INITIAL_ELO } from './chess.js';

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Returns updated Elo ratings after a game.
 * scoreA: 1 win, 0.5 draw, 0 loss for player A.
 */
export function updateElo(
  ratingA: number,
  ratingB: number,
  scoreA: number,
  k: number = ELO_K,
): { ratingA: number; ratingB: number } {
  const ea = expectedScore(ratingA, ratingB);
  const eb = 1 - ea;
  return {
    ratingA: Math.round(ratingA + k * (scoreA - ea)),
    ratingB: Math.round(ratingB + k * (1 - scoreA - eb)),
  };
}

export function scoreFromResult(
  result: '1-0' | '0-1' | '1/2-1/2',
  side: 'white' | 'black',
): number {
  if (result === '1/2-1/2') return 0.5;
  if (result === '1-0') return side === 'white' ? 1 : 0;
  return side === 'black' ? 1 : 0;
}

export { INITIAL_ELO };
