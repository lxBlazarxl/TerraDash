import { useState, useEffect } from 'react';
import './Players.css';

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(null);
  const [added, setAdded] = useState({});

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch('/api/players');
        const data = await res.json();
        setPlayers(data.players || []);
      } catch {
        setError('Failed to load players.');
      }
    };
    fetchPlayers();
  }, []);

  const addToAllowlist = async (player) => {
    setLoading(player);
    setError(null);
    try {
      await fetch(`/api/allowlist/${encodeURIComponent(player)}`, { method: 'POST' });
      setAdded(prev => ({ ...prev, [player]: true }));
    } catch {
      setError(`Failed to add ${player} to allowlist.`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="page players-page">
      <h1>Players</h1>
      {error && <div className="error-msg">{error}</div>}
      {players.length === 0 ? (
        <div className="empty">No players currently online.</div>
      ) : (
        <table className="players-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {players.map(player => (
              <tr key={player}>
                <td>{player}</td>
                <td>
                  <button
                    onClick={() => addToAllowlist(player)}
                    disabled={!!loading || added[player]}
                  >
                    {added[player]
                      ? 'Added to Allowlist'
                      : loading === player
                      ? 'Adding...'
                      : 'Add to Allowlist'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
