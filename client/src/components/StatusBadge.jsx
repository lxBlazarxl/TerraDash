import { useState, useEffect } from 'react';
import { getStateColor } from '../stateColors';
import './StatusBadge.css';

export default function StatusBadge() {
  const [state, setState] = useState('OFFLINE');

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('status request failed');
        const data = await res.json();
        setState(data.state || 'OFFLINE');
      } catch {
        setState('OFFLINE');
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  const color = getStateColor(state);

  return (
    <div className="status-badge">
      <span className="status-dot" style={{ background: color, color }} />
      <span className="status-label">{state}</span>
    </div>
  );
}
