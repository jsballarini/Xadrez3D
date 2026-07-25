import { useEffect, useState } from 'react';
import type { RankingEntry } from '@xadrez3d/shared';
import { Shell } from '../components/Shell';
import './pages.css';

export function RankingPage() {
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/ranking?limit=50');
        if (!res.ok) throw new Error('Falha ao carregar ranking');
        const data = (await res.json()) as { entries: RankingEntry[] };
        setEntries(data.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Shell>
      <section className="panel ranking-panel fade-rise">
        <h1 className="brand">Ranking</h1>
        <p className="muted">Elo por nickname (social — nicknames não são únicos).</p>
        {loading && <p>Carregando…</p>}
        {error && <p className="form-error">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="muted">Ainda sem partidas ranqueadas.</p>
        )}
        {entries.length > 0 && (
          <table className="ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nickname</th>
                <th>Elo</th>
                <th>V</th>
                <th>D</th>
                <th>E</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.nickname}-${e.updatedAt}`}>
                  <td>{i + 1}</td>
                  <td>{e.nickname}</td>
                  <td>{e.rating}</td>
                  <td>{e.wins}</td>
                  <td>{e.losses}</td>
                  <td>{e.draws}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Shell>
  );
}
