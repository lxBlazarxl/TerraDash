import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import './Worlds.css';

const SPECIAL_SEEDS = [
  { id: 1,  label: 'Normal' },
  { id: 2,  label: 'Not the Bees' },
  { id: 3,  label: 'Drunk' },
  { id: 4,  label: 'Celebration Mk 10' },
  { id: 5,  label: 'The Constant' },
  { id: 6,  label: 'For the Worthy' },
  { id: 7,  label: 'No Traps' },
  { id: 8,  label: 'Remix' },
  { id: 9,  label: 'Zenith' },
  { id: 10, label: 'Skyblock' },
];

// IDs toggled when Zenith is selected (excludes Normal=1 and Skyblock=10)
const ZENITH_SEEDS = [2, 3, 4, 5, 6, 7, 8, 9];

const defaultForm = { name: '', size: '1', difficulty: '1', evil: '1', seed: '', specialSeeds: [] };

export default function Worlds() {
  const [worlds, setWorlds] = useState([]);
  const [serverState, setServerState] = useState('OFFLINE');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      const [wRes, sRes] = await Promise.all([
        fetch('/api/worlds'),
        fetch('/api/status'),
      ]);
      const wData = await wRes.json();
      const sData = await sRes.json();
      setWorlds(wData.worlds || []);
      setServerState(sData.state);
    } catch {
      setError('Failed to load worlds.');
    }
  };

  useEffect(() => {
    fetchData();
    // Keep server state fresh so Load/Delete enablement tracks the backend.
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleSeed = (id) => {
    setForm(f => {
      const current = f.specialSeeds;

      // Normal selected → clear all special seeds
      if (id === 1) return { ...f, specialSeeds: [] };

      const has = current.includes(id);

      // Zenith toggled on → add all ZENITH_SEEDS
      if (id === 9 && !has) {
        const next = [...new Set([...current, ...ZENITH_SEEDS])];
        return { ...f, specialSeeds: next };
      }

      // Toggle normally
      const next = has ? current.filter(s => s !== id) : [...current, id];
      return { ...f, specialSeeds: next };
    });
  };

  const isNormal = form.specialSeeds.length === 0;

  const loadWorld = async (index) => {
    setLoading(`load-${index}`);
    setError(null);
    try {
      const res = await fetch('/api/worlds/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worldId: String(index + 1) }),
      });
      const data = await res.json();
      if (!data.success) setError(data.message);
    } catch {
      setError('Failed to load world.');
    } finally {
      setLoading(null);
    }
  };

  const deleteWorld = async (name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setLoading(`delete-${name}`);
    setError(null);
    try {
      const res = await fetch('/api/worlds/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worldName: name }),
      });
      const data = await res.json();
      if (!data.success) setError(data.message);
      else fetchData();
    } catch {
      setError('Failed to delete world.');
    } finally {
      setLoading(null);
    }
  };

  const createWorld = async (e) => {
    e.preventDefault();
    setLoading('create');
    setError(null);
    try {
      const res = await fetch('/api/worlds/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          size: form.size,
          difficulty: form.difficulty,
          evil: form.evil,
          seed: form.seed,
          specialSeeds: form.specialSeeds,
        }),
      });
      const data = await res.json();
      if (!data.success) setError(data.message);
      else {
        setShowCreate(false);
        setForm(defaultForm);
        fetchData();
      }
    } catch {
      setError('Failed to create world.');
    } finally {
      setLoading(null);
    }
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="page worlds-page">
      <div className="page-header">
        <h1>Worlds</h1>
        <button onClick={() => setShowCreate(true)}>+ Create World</button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="world-list">
        {worlds.length === 0 && <div className="empty">No worlds found.</div>}
        {worlds.map((world, i) => (
          <div className="world-card" key={world}>
            <span className="world-card-name">{world}</span>
            <div className="world-card-actions">
              <button
                onClick={() => loadWorld(i)}
                disabled={serverState !== 'MENU' || !!loading}
                title={
                  serverState !== 'MENU'
                    ? 'Start the server and leave it at the main menu to load a world'
                    : ''
                }
              >
                {loading === `load-${i}` ? 'Loading...' : 'Load'}
              </button>
              <button
                className="danger"
                onClick={() => deleteWorld(world)}
                disabled={
                  (serverState !== 'OFFLINE' && serverState !== 'MENU') || !!loading
                }
                title={
                  serverState !== 'OFFLINE' && serverState !== 'MENU'
                    ? 'Stop the running world before deleting'
                    : ''
                }
              >
                {loading === `delete-${world}` ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <Modal title="Create World" onClose={() => setShowCreate(false)}>
          <form onSubmit={createWorld}>
            <label>
              World Name
              <input
                value={form.name}
                onChange={set('name')}
                placeholder="MyWorld"
                required
              />
            </label>
            <label>
              Size
              <select value={form.size} onChange={set('size')}>
                <option value="1">Small</option>
                <option value="2">Medium</option>
                <option value="3">Large</option>
              </select>
            </label>
            <label>
              Difficulty
              <select value={form.difficulty} onChange={set('difficulty')}>
                <option value="1">Normal</option>
                <option value="2">Expert</option>
                <option value="3">Master</option>
                <option value="4">Journey</option>
              </select>
            </label>
            <label>
              Evil Type
              <select value={form.evil} onChange={set('evil')}>
                <option value="1">Random</option>
                <option value="2">Corruption</option>
                <option value="3">Crimson</option>
              </select>
            </label>
            <label>
              Seed <span style={{ opacity: 0.5, fontFamily: 'system-ui' }}>(optional)</span>
              <input
                value={form.seed}
                onChange={set('seed')}
                placeholder="Leave blank for random"
              />
            </label>
            <div className="seed-label">World Type</div>
            <div className="seed-grid">
              {SPECIAL_SEEDS.map(({ id, label }) => {
                const checked = id === 1 ? isNormal : form.specialSeeds.includes(id);
                return (
                  <label key={id} className="seed-option">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSeed(id)}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            <button type="submit" disabled={loading === 'create'}>
              {loading === 'create' ? 'Creating...' : 'Create World'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
