import { useState, useEffect } from 'react';
import { getStateColor } from '../stateColors';
import './Home.css';

export default function Home() {
  const [status, setStatus] = useState({ state: 'OFFLINE', world: null });
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(s => ({ ...s, state: 'OFFLINE' }));
    }
  };

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
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

  const runUpdate = async () => {
    setLoading('update');
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/power/update', { method: 'POST' });
      const data = await res.json();
      if (!data.success) setError(data.message);
      else setNotice(data.message);
      await fetchStatus();
    } catch {
      setError('Request failed.');
    } finally {
      setLoading(null);
    }
  };

  const isOffline = status.state === 'OFFLINE';
  const busy = !!loading;
  const version = status.serverVersion;
  const updateAvailable = version?.upToDate === false;

  return (
    <div className="page home-page surface">
      <h1>Server Status</h1>
      {error && <div className="error-msg">{error}</div>}
      {notice && <div className="notice-msg">{notice}</div>}

      <div className="status-card">
        <div
          className="big-status"
          style={{ color: getStateColor(status.state) }}
        >
          {status.state}
        </div>
        {status.world && (
          <div className="active-world">World: {status.world}</div>
        )}
        {version?.error && (
          <div className="version-note">Update check failed: {version.error}</div>
        )}
        {!version?.error && !version?.upToDate && version?.installedLabel && (
          <div className="version-note">
            Installed: v{version.installedLabel} — Latest: v{version.latestLabel}
          </div>
        )}
        {version?.upToDate && (
          <div className="version-note">Server version: v{version.latestLabel}</div>
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
        {updateAvailable && (
          <button
            onClick={runUpdate}
            disabled={busy}
            className="update-btn"
          >
            {loading === 'update' ? 'Updating...' : `Update Server (v${version.latestLabel})`}
          </button>
        )}
      </div>
    </div>
  );
}
