import { useState, useEffect } from 'react';
import './StatusBadge.css';

const stateColors = {
  ONLINE: '#5c8a2e',
  OFFLINE: '#6b2020',
  BOOTING: '#8b6914',
  CREATING: '#8b6914',
  MENU: '#2a5a8b',
};

export default function StatusBadge() {
  const [state, setState] = useState('OFFLINE');

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        setState(data.state);
      } catch {
        setState('OFFLINE');
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="status-badge">
      <span
        className="status-dot"
        style={{ background: stateColors[state] || '#555' }}
      />
      <span className="status-label">{state}</span>
    </div>
  );
}
