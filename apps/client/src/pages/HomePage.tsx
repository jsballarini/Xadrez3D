import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { createRoom, joinRoom, saveSession } from '../lib/socket';
import './pages.css';

export function HomePage() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(
    () => localStorage.getItem('xadrez3d.nickname') || '',
  );
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const persistNick = (value: string) => {
    setNickname(value);
    localStorage.setItem('xadrez3d.nickname', value);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('Informe um nickname');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createRoom({ nickname: nickname.trim(), hostColor: 'w' });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    saveSession({
      roomCode: res.room.code,
      playerId: res.playerId,
      nickname: nickname.trim(),
    });
    navigate(`/room/${res.room.code}`);
  };

  const onJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !roomCode.trim()) {
      setError('Nickname e código da sala são obrigatórios');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await joinRoom({
      nickname: nickname.trim(),
      roomCode: roomCode.trim().toUpperCase(),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    saveSession({
      roomCode: res.room.code,
      playerId: res.playerId,
      nickname: nickname.trim(),
    });
    navigate(`/room/${res.room.code}`);
  };

  return (
    <Shell>
      <section className="hero fade-rise">
        <p className="eyebrow">Tabuleiro vivo · salas · voz</p>
        <h1 className="brand hero-brand">Xadrez3D</h1>
        <p className="hero-lead">
          Partidas 3D online contra a máquina ou amigos — com chat, voz e webcam.
        </p>
        <div className="hero-cta">
          <Link className="cta-primary" to="/play">
            Jogar vs IA
          </Link>
          <Link className="cta-secondary" to="/ranking">
            Ver ranking
          </Link>
        </div>
      </section>

      <section className="home-grid fade-rise" style={{ animationDelay: '0.12s' }}>
        <form className="panel home-card" onSubmit={onCreate}>
          <h2>Criar sala</h2>
          <p className="muted">Gere um código e convide o oponente.</p>
          <label>
            Nickname
            <input
              value={nickname}
              onChange={(e) => persistNick(e.target.value)}
              placeholder="Seu nome"
              maxLength={24}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Criar sala multiplayer
          </button>
        </form>

        <form className="panel home-card" onSubmit={onJoin}>
          <h2>Entrar em sala</h2>
          <p className="muted">Use o código compartilhado pelo host.</p>
          <label>
            Nickname
            <input
              value={nickname}
              onChange={(e) => persistNick(e.target.value)}
              placeholder="Seu nome"
              maxLength={24}
              required
            />
          </label>
          <label>
            Código
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="AB12"
              maxLength={6}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Entrar
          </button>
        </form>
      </section>
      {error && <p className="form-error center">{error}</p>}
    </Shell>
  );
}
