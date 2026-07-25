import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { STARTING_FEN, type PieceColor } from '@xadrez3d/shared';
import { Chess } from 'chess.js';
import { ChessBoardCanvas } from '../components/ChessBoard';
import { Shell } from '../components/Shell';
import {
  formatClock,
  gameStatus,
  getLegalTargets,
  tryLocalMove,
} from '../lib/chessLocal';
import { StockfishEngine, uciToMove } from '../lib/stockfish';
import './pages.css';

export function SinglePlayerPage() {
  const [nickname, setNickname] = useState(
    () => localStorage.getItem('xadrez3d.nickname') || 'Jogador',
  );
  const [playerColor, setPlayerColor] = useState<PieceColor>('w');
  const [level, setLevel] = useState(5);
  const [fen, setFen] = useState(STARTING_FEN);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [started, setStarted] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [clocks, setClocks] = useState({ w: 10 * 60 * 1000, b: 10 * 60 * 1000 });
  const engineRef = useRef<StockfishEngine | null>(null);
  const rankedRef = useRef(false);

  const turn = useMemo(() => new Chess(fen).turn(), [fen]);
  const playerToMove = started && turn === playerColor && !thinking;

  useEffect(() => {
    engineRef.current = new StockfishEngine();
    void engineRef.current.init();
    return () => engineRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (!started || statusText) return;
    const id = setInterval(() => {
      setClocks((c) => {
        const key = turn;
        const next = { ...c, [key]: Math.max(0, c[key] - 1000) };
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [started, turn, statusText]);

  useEffect(() => {
    if (!started) return;
    if (clocks.w <= 0 || clocks.b <= 0) {
      const result = clocks.w <= 0 ? '0-1' : '1-0';
      finish(result, 'Tempo esgotado');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clocks, started]);

  const finish = useCallback(
    async (result: '1-0' | '0-1' | '1/2-1/2', reason: string) => {
      setStatusText(reason);
      if (rankedRef.current) return;
      rankedRef.current = true;
      // Normalize result from player perspective for API: white is always first seat in recordSingleplayer(nickname, Stockfish)
      // If player is white, result as-is; if player is black, invert for nickname vs Stockfish recording.
      let apiResult = result;
      if (playerColor === 'b') {
        if (result === '1-0') apiResult = '0-1';
        else if (result === '0-1') apiResult = '1-0';
      }
      // recordMatch(nickname, Stockfish, result) treats nickname as white — map so player's win = 1-0
      const playerWon =
        (playerColor === 'w' && result === '1-0') ||
        (playerColor === 'b' && result === '0-1');
      const playerLost =
        (playerColor === 'w' && result === '0-1') ||
        (playerColor === 'b' && result === '1-0');
      const mapped: '1-0' | '0-1' | '1/2-1/2' = playerWon
        ? '1-0'
        : playerLost
          ? '0-1'
          : '1/2-1/2';
      try {
        await fetch('/api/ranking/singleplayer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname, result: mapped }),
        });
      } catch {
        // ignore ranking errors offline
      }
      void apiResult;
    },
    [nickname, playerColor],
  );

  const applyPlayerMove = useCallback(
    (from: string, to: string) => {
      const needsPromo = (() => {
        const game = new Chess(fen);
        const piece = game.get(from as 'a1');
        return (
          piece?.type === 'p' &&
          ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'))
        );
      })();

      const applied = tryLocalMove(fen, {
        from,
        to,
        promotion: needsPromo ? 'q' : undefined,
      });
      if (!applied) return;
      setFen(applied.fen);
      setLastMove({ from: applied.from, to: applied.to });
      setHistory((h) => [...h, applied.san]);
      setSelected(null);

      const st = gameStatus(applied.fen);
      if (st.over) {
        void finish(st.result === '*' ? '1/2-1/2' : st.result, st.reason || 'Fim');
      }
    },
    [fen, finish],
  );

  useEffect(() => {
    if (!started || statusText) return;
    if (turn === playerColor) return;

    let cancelled = false;
    const run = async () => {
      setThinking(true);
      const engine = engineRef.current;
      let moveUci: string | null = null;
      if (engine) {
        moveUci = await engine.getBestMove(fen, level, 400 + level * 80);
      }
      if (cancelled) return;

      if (!moveUci) {
        // Fallback: random legal move
        const game = new Chess(fen);
        const moves = game.moves({ verbose: true });
        const pick = moves[Math.floor(Math.random() * moves.length)];
        if (!pick) {
          setThinking(false);
          return;
        }
        moveUci = `${pick.from}${pick.to}${pick.promotion || ''}`;
      }

      const parsed = uciToMove(moveUci);
      if (!parsed) {
        setThinking(false);
        return;
      }
      const applied = tryLocalMove(fen, parsed);
      if (!applied) {
        setThinking(false);
        return;
      }
      setFen(applied.fen);
      setLastMove({ from: applied.from, to: applied.to });
      setHistory((h) => [...h, applied.san]);
      setThinking(false);

      const st = gameStatus(applied.fen);
      if (st.over) {
        void finish(st.result === '*' ? '1/2-1/2' : st.result, st.reason || 'Fim');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [fen, finish, level, playerColor, started, statusText, turn]);

  const onSquareClick = (square: string) => {
    if (!playerToMove || statusText) return;
    if (selected) {
      const legal = getLegalTargets(fen, selected);
      if (legal.includes(square)) {
        applyPlayerMove(selected, square);
        return;
      }
    }
    const game = new Chess(fen);
    const piece = game.get(square as 'a1');
    if (piece && piece.color === playerColor) setSelected(square);
    else setSelected(null);
  };

  const start = () => {
    localStorage.setItem('xadrez3d.nickname', nickname);
    rankedRef.current = false;
    setFen(STARTING_FEN);
    setHistory([]);
    setLastMove(null);
    setSelected(null);
    setStatusText(null);
    setClocks({ w: 10 * 60 * 1000, b: 10 * 60 * 1000 });
    setStarted(true);
  };

  return (
    <Shell wide>
      <div className="play-layout fade-rise">
        <aside className="panel side-panel">
          <h2>Vs Stockfish</h2>
          {!started ? (
            <>
              <label>
                Nickname
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={24}
                />
              </label>
              <label>
                Sua cor
                <select
                  value={playerColor}
                  onChange={(e) => setPlayerColor(e.target.value as PieceColor)}
                >
                  <option value="w">Brancas</option>
                  <option value="b">Pretas</option>
                </select>
              </label>
              <label>
                Nível ({level})
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={level}
                  onChange={(e) => setLevel(Number(e.target.value))}
                />
              </label>
              <button type="button" onClick={start}>
                Iniciar partida
              </button>
            </>
          ) : (
            <>
              <div className="clocks">
                <div className={turn === 'b' ? 'clock active' : 'clock'}>
                  <span>Pretas</span>
                  <strong>{formatClock(clocks.b)}</strong>
                </div>
                <div className={turn === 'w' ? 'clock active' : 'clock'}>
                  <span>Brancas</span>
                  <strong>{formatClock(clocks.w)}</strong>
                </div>
              </div>
              <p className="muted">
                {thinking ? 'IA pensando…' : statusText || (playerToMove ? 'Sua vez' : 'Aguarde')}
              </p>
              <div className="move-list">
                {history.map((m, i) => (
                  <span key={`${m}-${i}`}>{m}</span>
                ))}
              </div>
              <button type="button" className="ghost" onClick={() => setStarted(false)}>
                Nova configuração
              </button>
              <Link to="/ranking">Ver ranking</Link>
            </>
          )}
        </aside>
        <ChessBoardCanvas
          fen={fen}
          orientation={playerColor}
          interactive={!!playerToMove && !statusText}
          selected={selected}
          lastMove={lastMove}
          onSquareClick={onSquareClick}
        />
      </div>
    </Shell>
  );
}
