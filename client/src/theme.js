// client/src/theme.js
export const themes = {
  home: {
    '--bg-image': 'url("https://cdn.akamai.steamstatic.com/steamcommunity/public/images/items/105600/b075f005440eebb33364c6c409fbde9d7f496499.jpg")',
    '--accent': '#7CFF7C',
    '--accent-glow': 'rgba(124, 255, 124, 0.3)',
    '--signature': '#5c8a2e',
    '--bg': '#0d1f0d',
    '--panel': '#1a3a1a',
    '--text': '#e8d5a3',
    '--border': '#2d5a1a',
  },
  worlds: {
    '--bg-image': 'url("https://cdn.akamai.steamstatic.com/steamcommunity/public/images/items/105600/0c3d0da2437bd7374927809260e098d4a8ed1785.jpg")',
    '--accent': '#FF7CFF',
    '--accent-glow': 'rgba(255, 124, 255, 0.3)',
    '--signature': '#c084fc',
    '--bg': '#1a0d2b',
    '--panel': '#2d1a1a',
    '--text': '#e8d5a3',
    '--border': '#4a1a6b',
  },
  players: {
    '--bg-image': 'url("https://cdn.akamai.steamstatic.com/steamcommunity/public/images/items/105600/5961dba9e72ef9e02a172fc77ce2d8447a781716.jpg")',
    '--accent': '#7CFF7C',
    '--accent-glow': 'rgba(124, 255, 124, 0.3)',
    '--signature': '#5c8a2e',
    '--bg': '#050f2b',
    '--panel': '#0a1f3a',
    '--text': '#e8d5a3',
    '--border': '#0a3a5a',
  },
  allowlist: {
    '--bg-image': 'url("https://cdn.akamai.steamstatic.com/steamcommunity/public/images/items/105600/a3329214133708ad7ac45fdea869fc0f3dad1e78.jpg")',
    '--accent': '#7CFFFF',
    '--accent-glow': 'rgba(124, 255, 255, 0.3)',
    '--signature': '#a8d8ea',
    '--bg': '#0d1f2b',
    '--panel': '#1a2f3a',
    '--text': '#f0f8ff',
    '--border': '#2a4a5a',
  },
  console: {
    '--bg-image': 'url("https://cdn.akamai.steamstatic.com/steamcommunity/public/images/items/105600/7dc9991e4750ae33365cb02f5a2707ee9bae4c2e.jpg")',
    '--accent': '#FF7C7C',
    '--accent-glow': 'rgba(255, 124, 124, 0.3)',
    '--signature': '#7c3aed',
    '--bg': '#05050f',
    '--panel': '#0d0d1f',
    '--text': '#e8d5a3',
    '--border': '#1a0a3a',
  },
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
