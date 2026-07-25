import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SinglePlayerPage } from './pages/SinglePlayerPage';
import { MultiplayerPage } from './pages/MultiplayerPage';
import { RankingPage } from './pages/RankingPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/play" element={<SinglePlayerPage />} />
      <Route path="/room/:code?" element={<MultiplayerPage />} />
      <Route path="/ranking" element={<RankingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
