import { Link } from 'react-router-dom';

interface ShellProps {
  children: React.ReactNode;
  wide?: boolean;
}

export function Shell({ children, wide }: ShellProps) {
  return (
    <div className={`app-shell ${wide ? 'wide' : ''}`}>
      <header className="topbar">
        <Link to="/" className="brand brand-link">
          Xadrez3D
        </Link>
        <nav>
          <Link to="/play">Vs IA</Link>
          <Link to="/room">Multiplayer</Link>
          <Link to="/ranking">Ranking</Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
