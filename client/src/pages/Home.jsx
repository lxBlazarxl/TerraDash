import { useState, useEffect } from 'react';
import './Home.css';

const stateColors = {
  ONLINE: '#5c8a2e',
  OFFLINE: '#6b2020',
  BOOTING: '#8b6914',
  CREATING: '#8b6914',
  MENU: '#2a5a8b',
};

export default function Home() {
  const [status, setStatus] = useState({ state: 'OFFLINE', world: null });
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        setStatus(data);
      } catch {
        setStatus(s => ({ ...s, state: 'OFFLINE' }));
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  const action = async (endpoint, label) => {
    setLoading(label);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (!data.success) setError(data.message);
    } catch {
      setError('Request failed.');
    } finally {
      setLoading(null);
    }
  };

  const isOffline = status.state === 'OFFLINE';
  const busy = !!loading;

  return (
    <div className="page home-page glass-panel">
      <h1 className="mana-glow">Server Status</h1>
      {error && <div className="error-msg">{error}</div>}

      <div className="status-card">
        <div
          className="big-status"
          style={{ color: stateColors[status.state] || '#888' }}
        >
          {status.state}
        </div>
        {status.world && (
          <div className="active-world">World: {status.world}</div>
        )}
      </div>

      <div className="home-actions">
        <button
          onClick={() => action('/api/power/on', 'start')}
          disabled={!isOffline || busy}
        >
          {loading === 'start' ? 'Starting...' : 'Start Server'}
        </button>
        <button
          onClick={() => action('/api/power/off', 'stop')}
          disabled={isOffline || busy}
          className="danger"
        >
          {loading === 'stop' ? 'Stopping...' : 'Stop Server'}
        </button>
        <button
          onClick={() => action('/api/power/restart', 'restart')}
          disabled={isOffline || busy}
        >
          {loading === 'restart' ? 'Restarting...' : 'Restart'}
        </button>
      </div>
    </div>
  );
}
