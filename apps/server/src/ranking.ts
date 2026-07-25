import fs from 'node:fs';
import path from 'node:path';
import {
  INITIAL_ELO,
  scoreFromResult,
  updateElo,
  type RankingEntry,
} from '@xadrez3d/shared';

interface DbPlayer {
  nickname: string;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  updatedAt: string;
}

interface DbShape {
  players: Record<string, DbPlayer>;
}

/**
 * File-backed ranking store (JSON). Avoids native SQLite bindings for easier installs.
 */
export class RankingStore {
  private readonly filePath: string;
  private data: DbShape;

  constructor(databasePath: string) {
    // Allow .db path from env but persist as .json beside it
    this.filePath = databasePath.replace(/\.db$/i, '.json');
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    this.data = this.load();
  }

  getOrCreate(nickname: string): RankingEntry {
    const key = nickname.toLowerCase();
    const existing = this.data.players[key];
    if (existing) return this.map(existing);

    const now = new Date().toISOString();
    const created: DbPlayer = {
      nickname,
      wins: 0,
      losses: 0,
      draws: 0,
      rating: INITIAL_ELO,
      updatedAt: now,
    };
    this.data.players[key] = created;
    this.save();
    return this.map(created);
  }

  recordMatch(
    whiteNickname: string,
    blackNickname: string,
    result: '1-0' | '0-1' | '1/2-1/2',
  ): void {
    const white = this.getOrCreate(whiteNickname);
    const black = this.getOrCreate(blackNickname);
    const scoreWhite = scoreFromResult(result, 'white');
    const { ratingA, ratingB } = updateElo(white.rating, black.rating, scoreWhite);
    const now = new Date().toISOString();

    const wKey = whiteNickname.toLowerCase();
    const bKey = blackNickname.toLowerCase();
    const w = this.data.players[wKey]!;
    const b = this.data.players[bKey]!;

    w.rating = ratingA;
    b.rating = ratingB;
    w.updatedAt = now;
    b.updatedAt = now;

    if (result === '1-0') {
      w.wins += 1;
      b.losses += 1;
    } else if (result === '0-1') {
      b.wins += 1;
      w.losses += 1;
    } else {
      w.draws += 1;
      b.draws += 1;
    }

    this.save();
  }

  recordSingleplayer(nickname: string, result: '1-0' | '0-1' | '1/2-1/2'): void {
    this.recordMatch(nickname, 'Stockfish', result);
  }

  top(limit = 50): RankingEntry[] {
    return Object.values(this.data.players)
      .filter((p) => p.nickname.toLowerCase() !== 'stockfish')
      .sort((a, b) => b.rating - a.rating || b.wins - a.wins)
      .slice(0, limit)
      .map((p) => this.map(p));
  }

  private map(row: DbPlayer): RankingEntry {
    return {
      nickname: row.nickname,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      rating: row.rating,
      updatedAt: row.updatedAt,
    };
  }

  private load(): DbShape {
    try {
      if (!fs.existsSync(this.filePath)) return { players: {} };
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as DbShape;
      return parsed.players ? parsed : { players: {} };
    } catch {
      return { players: {} };
    }
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }
}
