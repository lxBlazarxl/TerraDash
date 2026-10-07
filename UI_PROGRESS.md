# TerraDash UI Rework — Progress Tracker

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

Last updated: (start of rework)

---

## 1. Current State

**Stack**: Vite + React 18 SPA, `react-router-dom` v7, plain CSS (one `.css` per component, imported from the JSX). No CSS framework, no CSS modules, no `preprocessor`. Single font (`Andy Bold.ttf`, bold-only) used for headings/buttons/labels; body text is `system-ui`.

**Structure**

```
client/
├── index.html                 12 lines   lang=en, viewport set, no meta description/favicon
└── src/
    ├── main.jsx               10         StrictMode root
    ├── App.jsx                46         BrowserRouter, ThemeSync, BackgroundLayer, 5 routes
    ├── App.css                36         app-shell, biome-bg, main-content, .page
    ├── index.css             136         design tokens, buttons, inputs, .glass-panel, .empty
    ├── theme.js               69         5 biome themes (CSS vars) + route→theme map
    ├── components/           Sidebar (36) · StatusBadge (39) · Modal (15)
    └── pages/                Home (131) · Worlds (245) · Players (73) · Allowlist (153) · Console (117)
```

**Theming model**: `theme.js` sets `--bg-image`, `--accent`, `--accent-glow`, `--signature`, `--bg`, `--panel`, `--text`, `--border` on `documentElement` per route. `Home`/`Players` share a green palette, `Worlds` pink, `Allowlist` cyan, `Console` red, each with a Steam CDN biome background image.

**What works well (keep)**
- Cohesive biome-per-route concept; it is the strongest identity asset.
- `glass-panel` + fixed biome backdrop reads nicely on desktop.
- `theme.js` is a clean, single-place theme registry — good foundation to build tokens on.
- Server-side state machine is rich (`ONLINE`/`BOOTING`/`CREATING`/`MENU`/`OFFLINE`) and surfaced consistently.
- Route split (5 focused pages) is sensible.

---

## 2. Problems Found (audit)

### P1 — Correctness / robustness
| # | Issue | Evidence |
|---|---|---|
| 1 | `--accent-glow` is used in `index.css:57,135` but never defined in `:root`; only `theme.js` defines it. Any render before/without a theme gets an invalid `box-shadow`/`text-shadow`. | `index.css:14-21` |
| 2 | `:root` tokens are stale duplicates of the `home` theme and disagree with it (`--accent: #5c8a2e` vs theme `#7CFF7C`). Two sources of truth. | `index.css:15-20` vs `theme.js:3-12` |
| 3 | `stateColors` map is duplicated verbatim in two components and hardcodes dark, off-palette colors that clash with the bright theme accents. | `Home.jsx:4-10`, `StatusBadge.jsx:4-10` |
| 4 | Home + StatusBadge each poll `/api/status` every 3s independently — duplicate requests, no shared cache, no coordination. | `Home.jsx:17-30`, `StatusBadge.jsx:15-28` |
| 5 | Loading is indistinguishable from empty: "No worlds found." / "No players currently online." / "No logs available." render while the first fetch is still in flight. | `Worlds.jsx:152`, `Players.jsx:40`, `Console.jsx:71` |
| 6 | Several actions ignore the response body, so server-side failures are silent: `grantCommand`/`revokeCommand`/`removePlayer` never check `data.success` (a 404 for an unknown player looks like success). | `Allowlist.jsx:44-50,57-66,28-30` |
| 7 | `Players` fetches once on mount only, so the online-player list goes stale while the page is open; the server's `message` ("Server is not currently online.") is discarded. | `Players.jsx:10-21,15` |
| 8 | Console renders up to 1000 log entries (server `MAX_LOGS`) as plain DOM nodes with `key={index}`, fully re-rendered every 2s; smooth `scrollIntoView` on every poll fights the user scrolling up. | `Console.jsx:74-80,30-34` |
| 9 | Dead CSS: `.log-type` and `.log-entry.fail` are never applied — error/level styling exists but nothing uses it. | `Console.css:56-65` |
| 10 | No 404 route: unknown paths render an empty content area. No error boundary: a render crash white-screens the app. | `App.jsx:35-41` |
| 11 | `Worlds` load uses positional IDs (`String(index + 1)`), coupling the UI to list order. | `Worlds.jsx:78` |

### P2 — Accessibility
| # | Issue | Evidence |
|---|---|---|
| 12 | **Zero** `aria-*`/`role` attributes in the entire client. Modal has no `role="dialog"`, no `aria-modal`, no labelled title. | grep: 0 hits |
| 13 | **Zero** `:focus-visible` styles — buttons/links are keyboard-invisible. Only `input:focus` has an outline. | grep: 0 hits; `index.css:87` |
| 14 | Icon-only buttons have no accessible name: modal close `×`, command-tag revoke `×`, chevron `▲▼`. | `Modal.jsx:9`, `Allowlist.jsx:121-127`, `Allowlist.jsx:106-108` |
| 15 | Expandable allowlist row is a `<div onClick>` — not focusable, no `aria-expanded`, no keyboard support. | `Allowlist.jsx:90-93` |
| 16 | Modal has no Escape handler, no focus trap, no background scroll lock. | `Modal.jsx` |
| 17 | **Zero** media queries — no responsive layout at all; sidebar is a fixed 220px + 20px margins and `body { overflow: hidden }`, so the dashboard is unusable on phones/tablets. | grep: 0 hits; `App.css:1-5`, `index.css:34`, `Sidebar.css:1-13` |

### P3 — Visual design / consistency
| # | Issue | Evidence |
|---|---|---|
| 18 | A global `transition` on `*` (bg/color/border/box-shadow) plus `transition: all 0.3s` on buttons — every element animates on every state change; janky and hard to reason about. | `index.css:7-12,51` |
| 19 | No token system: spacing, radii (4/8/12/16px), shadows, z-index and breakpoints are magic numbers in 12 files. | all CSS |
| 20 | Surface treatment is inconsistent: pages use translucent `glass-panel`, but the modal and console input use flat `var(--panel)`. | `Modal.css:12`, `Console.css:2` |
| 21 | `.update-btn` hardcodes literal hexes instead of theme vars, so it ignores the active biome. | `Home.css:39-42` |
| 22 | `transition: background-image 1s` on the backdrop is a no-op (URL swaps don't animate), and the same image is painted twice (`.biome-bg` + `.glass-panel::before` at 0.05 opacity). | `App.css:16`, `index.css:119-132` |
| 23 | Five remote Steam CDN background URLs are hardcoded — external runtime dependency, breaks offline/air-gapped use, no local fallback. | `theme.js:4,14,24,34,44` |
| 24 | Only a bold pixel font is available; body copy is `system-ui`, so headings and UI labels clash stylistically with content text. No font scale/weight system. | `index.css:1-5,39` |
| 25 | No design polish for state: status dot is a static 10px circle, no glow/pulse for ONLINE, no transition between states. | `StatusBadge.css:7-12` |

### P4 — UX / feedback
| # | Issue | Evidence |
|---|---|---|
| 26 | Native `confirm()` for destructive actions — breaks the theme and looks unfinished. | `Worlds.jsx:90`, `Allowlist.jsx:24` |
| 27 | Feedback is ad-hoc per page (`error-msg` strings + one `notice-msg`); errors linger until the next action; no toasts, no undo. | `Home.jsx:56-57` |
| 28 | The **Update Server** button downloads ~45MB and can restart a running server with a single unconfirmed click. | `Home.jsx:113-119` |
| 29 | Home shows only a state word — no at-a-glance stats (players online, loaded world, server version, uptime) even though the API exposes them. | `Home.jsx:54-64` |
| 30 | Worlds page fetches `/api/status` but keeps only `state`, discarding `world` — no "this world is currently loaded" indicator. | `Worlds.jsx:33-40` |
| 31 | Console sends commands even when the server is OFFLINE, guaranteeing a 403 round-trip; no command history, no filter/search. | `Console.jsx:36-63,92-112` |
| 32 | World creation doesn't preview the sanitized filename (`My World` → `My_World`) or explain the hand-rolled special-seed rules (magic IDs 1/9/10). | `Worlds.jsx:5-19,48-67` |
| 33 | No loading skeletons/spinners on any action; buttons flip text but layout shifts. | all pages |

### P5 — Safety net
| # | Issue | Evidence |
|---|---|---|
| 34 | **Zero frontend tests.** A whole-UI rework with no component or visual regression coverage. Backend has 88 tests. | — |
| 35 | `npm run build` is broken in this environment (bad `node_modules/.bin/vite` shim); no lint/format/typecheck script for the client. | `package.json` |

---

## 3. Rework Plan

Phases are ordered so each one leaves the app in a working, shippable state.

### Phase 0 — Safety net (do this first)
- [ ] **0.1** Fix `vite` bin resolution so `npm run build` works again
- [ ] **0.2** Add Vitest + jsdom + React Testing Library; smoke-test each page renders
- [ ] **0.3** Add a `lint`/`format` script (ESLint flat config + Prettier) for `client/`
- [ ] **0.4** Add `test:ui` script and include it in CI expectations

### Phase 1 — Foundations (tokens, theme, typography, reset)
- [x] **1.1** Token layer in `index.css`: color roles (`--surface-1/2`, `--surface-hover/active`, `--border-subtle/strong`, `--text-strong/dim/faint`), semantic (`--ok/--warn/--danger` + `-soft`/`-border`/`-glow`), state colors (`--state-*`), spacing (`--space-1..9`), radii, shadows, z-index, type scale, motion tokens
- [x] **1.2** `theme.js` is the only source of biome colors; `:root` keeps a bootstrap mirror of `themes.home` that a test enforces. Every other token derives from the 8 biome vars via `color-mix`, so a theme is 8 lines
- [x] **1.3** Every referenced custom property is defined (`--accent-glow` bug fixed); `tests/ui-tokens.test.js` fails the build on an undefined `var()`, a drifted bootstrap, an incomplete theme, or a dead token
- [~] **1.4** Typography: `font-display: swap`, preload in `index.html`, `meta description`, type scale (`--text-xs..2xl`), display font restricted to headings/labels/buttons/nav with `font-weight: 400` (no faux bold). **Remaining:** a true display+body font *pairing* needs a second font file — `Andy Bold.ttf` is the only asset in `client/public/fonts/`
- [x] **1.5** Global `transition` on `*` and `transition: all` removed; scoped transitions on the elements that read biome colors, all via `--dur-*`/`--ease-*`. Dead `background-image` transition dropped
- [~] **1.6** One `.surface` recipe: glass (`.surface`) + opaque (`.surface--flat`). Applied to the Home panel, Modal, and console composer; `.glass-panel` removed. **Remaining:** page-level surfaces for Worlds/Players/Allowlist/Console land with their Phase 5 rewrites

### Phase 2 — Responsive layout & app shell
- [ ] **2.1** Define breakpoints (`--bp-sm/md/lg`) and a container/page layout that adapts
- [ ] **2.2** Sidebar → responsive drawer: hamburger + overlay on `<md`, fixed rail on `lg+`; active-route indicator, keyboard reachable
- [ ] **2.3** `main-content` padding/typography scale per breakpoint; remove the fixed 880px cap in favour of max-width + fluid grid
- [ ] **2.4** Fix `100vh`/`overflow: hidden` mobile issues (`100dvh`, safe-area insets)
- [ ] **2.5** Add a 404 route and an error boundary (graceful "something broke" panel + reload)

### Phase 3 — Shared UI components
- [ ] **3.1** `Button` component with variants (primary/secondary/danger/ghost), sizes, loading state (spinner, no layout shift), icon support
- [ ] **3.2** `Card`/`Panel`, `Badge`, `Tooltip`, `Field` (label+input+hint+error), `Select`, `Checkbox`, `Toggle`
- [ ] **3.3** Upgrade `Modal`: focus trap, Escape to close, scroll lock, `role="dialog"` + `aria-modal`, labelled by title, backdrop blur, mobile bottom-sheet variant
- [ ] **3.4** New `ConfirmDialog` replacing native `confirm()` for destructive actions
- [ ] **3.5** `Toast` system (success/error/info, auto-dismiss, stacking, aria-live) replacing ad-hoc `error-msg`/`notice-msg`
- [ ] **3.6** `EmptyState` and `Skeleton` components; `Table` primitive with responsive/stacked mode
- [ ] **3.7** `StatusPill` component — the single owner of state→color/label/icon mapping (replaces duplicated `stateColors`)

### Phase 4 — Data layer (hooks/context)
- [ ] **4.1** `usePoll(fn, interval)` hook: visibility-aware (`document.hidden` pause), abortable, manual `refresh()`, backoff on error
- [ ] **4.2** `StatusProvider` context: one `/api/status` poll shared by Home, Sidebar badge, Worlds (fixes P1.4)
- [ ] **4.3** `useApi` helper: JSON handling, error normalization, `success` checking so no action can silently ignore a server error (fixes P1.6)
- [ ] **4.4** Loading/error/empty state machine per resource so pages never confuse "loading" with "empty" (fixes P1.5)

### Phase 5 — Page-by-page rework
- [ ] **5.1 Home**: stat grid (state, world, players online, server version), primary/secondary action hierarchy, version + update banner moved here from the ad-hoc block, **confirm before update** (fixes P4.28), quick links
- [ ] **5.2 Worlds**: card grid with loaded indicator (fixes P4.30), search/filter, sort, ConfirmDialog delete, skeleton + true empty state, create modal rework with sanitized-name preview and explained world-type rules (fixes P4.32)
- [ ] **5.3 Console**: sticky composer at the bottom, log level styling wired up (fixes P1.9), filter/search + level toggles, command history (↑/↓), disable inputs when not ONLINE (fixes P4.31), virtualized or windowed rendering (fixes P1.8), "jump to latest" when scrolled up, copy-log
- [ ] **5.4 Players**: live polling while ONLINE (fixes P1.7), player count + server-state context, offline hint using the server message, responsive cards instead of a 2-column table, richer row actions
- [ ] **5.5 Allowlist**: accessible disclosure rows (`aria-expanded`, keyboard), command tags with proper icon buttons, search/filter, add-player input, Grant/Revoke with real error surfacing, bulk actions, per-player command count summary
- [ ] **5.6 Sidebar**: branding, nav icons, active state polish, status pill, version/build info, mobile drawer behavior

### Phase 6 — Theming & polish
- [ ] **6.1** Replace remote CDN biome images with local assets (bundled or optional download) + graceful fallback (fixes P3.23)
- [ ] **6.2** Consistent biome themes: derive state/danger/warn colors per theme so every route is coherent
- [ ] **6.3** Motion pass: state transitions, status pulse for ONLINE, modal/toast animation, `prefers-reduced-motion` support
- [ ] **6.4** Scrollbar styling, selection color, scroll shadows on log/panel edges
- [ ] **6.5** Icon set (inline SVG) for nav/actions/status; no emoji as UI affordances
- [ ] **6.6** Empty/edge polish: long world names, many players, huge logs, slow network, offline server

### Phase 7 — Verification
- [ ] **7.1** Component tests for every shared component + page
- [ ] **7.2** Playwright smoke: navigate all routes, power on/off, create/delete world, run a command, trigger update
- [ ] **7.3** Visual regression snapshots at mobile/tablet/desktop widths
- [ ] **7.4** Keyboard-only pass and screen-reader smoke test
- [ ] **7.5** Lighthouse/bundle-size check; confirm no perf regression from the console list

---

## 4. Decisions to Make

| Question | Options | Status |
|---|---|---|
| CSS strategy | (a) keep per-component CSS + tokens, (b) CSS Modules, (c) Tailwind, (d) vanilla-extract | open — recommend (a) to minimize churn |
| Dark-only, or add a light theme? | (a) dark only (biome identity), (b) both | open — recommend (a) for now |
| Keep per-route biome themes? | (a) keep, (b) single theme + accent switch, (c) user-selectable | open — recommend (a), it's the identity |
| Background images: bundle locally? | (a) yes, commit assets, (b) keep CDN + cache, (c) make optional/configurable | open |
| Icon approach | (a) inline SVG components, (b) icon font, (c) external lib | open — recommend (a) |
| Frontend tests in scope now? | (a) Vitest+RTL only, (b) + Playwright, (c) defer | open — recommend (a) now, (b) in Phase 7 |

---

## 5. Progress Log

| Date | Phase | Change | Tests |
|---|---|---|---|
| — | — | Audit complete; document created | 88/88 backend passing |
| Phase 1 | 1.1–1.6 | Token layer + `theme.js` as single biome source + token guard test + scoped transitions + unified `.surface` recipe. Fixed P1.1 (`--accent-glow`), P1.3 (duplicated `stateColors` → `client/src/stateColors.js` reading `--state-*`), P1.9 (dead `.log-entry.fail` wired to the server's `[ERR]` tag), P3.18 (`transition: all`), P3.20/21 (surface + hardcoded hexes) | 93/93 passing (`tests/ui-tokens.test.js` adds 5) |
| Phase 1 | drive-by | **Bug fix:** `server.js` used `app.get('*')`, which throws on Express 5 — `NODE_ENV=production` crashed on boot. Changed to `/{*splat}` | verified: prod server boots, `/` and deep links return 200 |
| Phase 1 | visual | Verified all 5 routes with headless Chrome screenshots at 1440×900. Two contrast bugs found and fixed: glass panels were unreadable over bright biome art (added a `--bg`-tinted scrim under the white sheen) and `.empty` states floated bare on the background (now a dashed surface) | screenshot pass, `npm run build` clean |

### Notes for later phases
- **Visual verification is available now** without Playwright: `NODE_ENV=production node server.js` then
  `google-chrome-stable --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1440,900 --virtual-time-budget=6000 --screenshot=out.png http://localhost:5000/<route>`.
  Use this for Phase 5 page work; Phase 7.3 should formalize it into Playwright visual regression.
- `npm run build` is still broken by the `node_modules/.bin/vite` shim in this environment; use
  `node node_modules/vite/bin/vite.js build client/`. Fixing it properly is Phase 0 item 0.1.
- `color-mix()` is used for derived tokens (baseline-supported since 2023). If older browsers must be
  supported, add literal fallbacks for `--surface-hover`, `--surface-active`, and button backgrounds.
- Derived tokens re-resolve per theme automatically, so theming never needs to touch component CSS.
