// A single monochrome palette shared by every route.
// index.css mirrors these values before React mounts.
const monochrome = {
  '--bg': '#0a0a0a',
  '--panel': '#141414',
  '--text': '#e5e5e5',
  '--border': '#404040',
  '--accent': '#ffffff',
};

export const themes = {
  home: monochrome,
  worlds: monochrome,
  players: monochrome,
  allowlist: monochrome,
  console: monochrome,
};

export const routeThemes = {
  '/': 'home',
  '/worlds': 'worlds',
  '/players': 'players',
  '/allowlist': 'allowlist',
  '/console': 'console',
};

export const applyTheme = (themeName) => {
  const theme = themes[themeName];
  if (!theme) return;
  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
};
