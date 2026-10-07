// client/src/stateColors.js
//
// Single source of truth for server-state colors. The values live in CSS
// (index.css `--state-*`) so they can be themed and read by both CSS and JS.
// Replaces the duplicated hardcoded maps that previously lived in Home.jsx and
// StatusBadge.jsx.

const FALLBACK = {
  ONLINE: '#ffffff',
  OFFLINE: '#909090',
  BOOTING: '#d4d4d4',
  CREATING: '#d4d4d4',
  MENU: '#b0b0b0',
};

const cache = new Map();

const readToken = (token, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value || fallback;
};

export const getStateColor = (state) => {
  if (!cache.has(state)) {
    cache.set(state, readToken(`--state-${String(state).toLowerCase()}`, FALLBACK[state] || '#888'));
  }
  return cache.get(state);
};

export const STATE_KEYS = Object.keys(FALLBACK);
