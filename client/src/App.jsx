import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { applyTheme, routeThemes } from './theme';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Worlds from './pages/Worlds';
import Players from './pages/Players';
import Allowlist from './pages/Allowlist';
import Console from './pages/Console';
import './App.css';

function ThemeSync() {
  const location = useLocation();
  useEffect(() => {
    const theme = routeThemes[location.pathname] || 'home';
    applyTheme(theme);
  }, [location.pathname]);
  return null;
}

function BackgroundLayer() {
  return (
    <div className="biome-bg" style={{ backgroundImage: 'var(--bg-image)' }} />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <BackgroundLayer />
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/worlds" element={<Worlds />} />
            <Route path="/players" element={<Players />} />
            <Route path="/allowlist" element={<Allowlist />} />
            <Route path="/console" element={<Console />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
