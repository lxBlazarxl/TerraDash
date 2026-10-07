import { useState, useEffect, useRef } from 'react';
import './Console.css';

export default function Console() {
  const [command, setCommand] = useState('');
  const [sayText, setSayText] = useState('');
  const [serverLogs, setServerLogs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(null);
  const logEndRef = useRef(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/status/logs');
      const data = await res.json();
      if (data.success) {
        setServerLogs(data.logs);
      }
    } catch {
      console.error('Failed to fetch logs');
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [serverLogs]);

  const send = async (type) => {
    const value = type === 'command' ? command.trim() : sayText.trim();
    if (!value) return;
    setError(null);
    setLoading(type);
    try {
      const body = type === 'command'
        ? { command: value }
        : { sayCommand: value };
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Failed to send command.');
      }
      if (type === 'command') setCommand('');
      else setSayText('');
      // Trigger immediate refresh for feedback
      fetchLogs();
    } catch {
      setError('Failed to send command.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="page console-page">
      <h1>Console</h1>
      {error && <div className="error-msg">{error}</div>}

      <div className="console-log">
        {serverLogs.length === 0 && (
          <div className="empty">No logs available. Start the server to see output.</div>
        )}
        {serverLogs.map((entry, i) => (
          <div
            className={`log-entry${entry.content.startsWith('[ERR]') ? ' err' : ''}`}
            key={i}
          >
            <span className="log-time">{entry.time}</span>
            <span className="log-value">{entry.content}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      <div className="console-inputs">
        <div className="input-row">
          <label>Command</label>
          <input
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send('command')}
            placeholder="e.g. noon, dawn, help"
          />
          <button
            onClick={() => send('command')}
            disabled={!command.trim() || !!loading}
          >
            {loading === 'command' ? 'Sending...' : 'Send'}
          </button>
        </div>
        <div className="input-row">
          <label>Broadcast</label>
          <input
            value={sayText}
            onChange={e => setSayText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send('say')}
            placeholder="Message to all players"
          />
          <button
            onClick={() => send('say')}
            disabled={!sayText.trim() || !!loading}
          >
            {loading === 'say' ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
