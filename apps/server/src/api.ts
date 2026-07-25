import cors from 'cors';
import express from 'express';
import type { RankingStore } from './ranking.js';

export function createApi(ranking: RankingStore, clientOrigin: string) {
  const app = express();
  app.use(
    cors({
      origin: clientOrigin,
      methods: ['GET', 'POST'],
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'xadrez3d-server' });
  });

  app.get('/api/ranking', (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    res.json({ entries: ranking.top(limit) });
  });

  app.post('/api/ranking/singleplayer', (req, res) => {
    const { nickname, result } = req.body as {
      nickname?: string;
      result?: '1-0' | '0-1' | '1/2-1/2';
    };
    if (!nickname || !result) {
      res.status(400).json({ error: 'nickname e result são obrigatórios' });
      return;
    }
    if (!['1-0', '0-1', '1/2-1/2'].includes(result)) {
      res.status(400).json({ error: 'result inválido' });
      return;
    }
    ranking.recordSingleplayer(nickname.trim().slice(0, 24), result);
    res.json({ ok: true });
  });

  return app;
}
