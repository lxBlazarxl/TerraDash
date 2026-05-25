import { useState, useEffect } from 'react';
import './Allowlist.css';

export default function Allowlist() {
  const [allowlist, setAllowlist] = useState({});
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [commandInputs, setCommandInputs] = useState({});
  const [loading, setLoading] = useState(null);

  const fetchAllowlist = async () => {
    try {
      const res = await fetch('/api/allowlist');
      const data = await res.json();
      setAllowlist(data.allowlist || {});
    } catch {
      setError('Failed to load allowlist.');
    }
  };

  useEffect(() => { fetchAllowlist(); }, []);

  const removePlayer = async (player) => {
    if (!confirm(`Remove "${player}" from allowlist?`)) return;
    setLoading(`remove-${player}`);
    setError(null);
    try {
      await fetch(`/api/allowlist/${encodeURIComponent(player)}`, { method: 'DELETE' });
      if (expanded === player) setExpanded(null);
      fetchAllowlist();
    } catch {
      setError(`Failed to remove ${player}.`);
    } finally {
      setLoading(null);
    }
  };

  const grantCommand = async (player) => {
    const command = (commandInputs[player] || '').trim();
    if (!command) return;
    setLoading(`grant-${player}`);
    setError(null);
    try {
      await fetch(
        `/api/allowlist/${encodeURIComponent(player)}/commands/${encodeURIComponent(command)}`,
        { method: 'POST' }
      );
      setCommandInputs(prev => ({ ...prev, [player]: '' }));
      fetchAllowlist();
    } catch {
      setError('Failed to grant command.');
    } finally {
      setLoading(null);
    }
  };

  const revokeCommand = async (player, command) => {
    setLoading(`revoke-${player}-${command}`);
    setError(null);
    try {
      await fetch(
        `/api/allowlist/${encodeURIComponent(player)}/commands/${encodeURIComponent(command)}`,
        { method: 'DELETE' }
      );
      fetchAllowlist();
    } catch {
      setError('Failed to revoke command.');
    } finally {
      setLoading(null);
    }
  };

  const setInput = (player, value) =>
    setCommandInputs(prev => ({ ...prev, [player]: value }));

  const players = Object.keys(allowlist);

  return (
    <div className="page allowlist-page">
      <h1>Allowlist</h1>
      {error && <div className="error-msg">{error}</div>}
      {players.length === 0 ? (
        <div className="empty">
          No players on allowlist. Add players from the Players page.
        </div>
      ) : (
        <div className="allowlist-list">
          {players.map(player => (
            <div className="allowlist-row" key={player}>
              <div
                className="allowlist-row-header"
                onClick={() => setExpanded(expanded === player ? null : player)}
              >
                <span className="player-name">{player}</span>
                <div className="row-meta">
                  <span className="cmd-count">
                    {allowlist[player].length} command{allowlist[player].length !== 1 ? 's' : ''}
                  </span>
                  <button
                    className="danger"
                    onClick={e => { e.stopPropagation(); removePlayer(player); }}
                    disabled={!!loading}
                  >
                    Remove
                  </button>
                  <span className="expand-chevron">
                    {expanded === player ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {expanded === player && (
                <div className="allowlist-row-body">
                  <div className="command-tags">
                    {allowlist[player].length === 0 && (
                      <span className="no-commands">No commands granted.</span>
                    )}
                    {allowlist[player].map(cmd => (
                      <span className="command-tag" key={cmd}>
                        {cmd}
                        <button
                          onClick={() => revokeCommand(player, cmd)}
                          disabled={!!loading}
                          title="Revoke"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="grant-row">
                    <input
                      placeholder="Command name (e.g. noon)"
                      value={commandInputs[player] || ''}
                      onChange={e => setInput(player, e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && grantCommand(player)}
                    />
                    <button
                      onClick={() => grantCommand(player)}
                      disabled={!!loading || !(commandInputs[player] || '').trim()}
                    >
                      {loading === `grant-${player}` ? 'Granting...' : 'Grant'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
