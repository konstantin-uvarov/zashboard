# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build (outputs to dist/)
pnpm lint         # ESLint with --fix
pnpm format       # Prettier + import organization + Tailwind class sorting
pnpm type-check   # Vue TypeScript compiler check
```

Pre-commit hooks (Husky + lint-staged) run lint and format on staged files automatically.

## Architecture

**Zashboard** is a Vue 3 + TypeScript dashboard for Clash/Mihomo/Sing-box proxy cores. It talks to the Clash REST API and a WebSocket stream, displays proxy groups, live connections, rules, logs, and traffic stats.

### Data flow

1. User enters backend credentials on `SetupPage` → stored in localStorage via VueUse.
2. `src/api/` configures Axios (Bearer token auth) and a `ReconnectingWebSocket` pointing at the Clash API.
3. Stores (`src/store/`) call the API and expose reactive state. Components read from stores; they do not call the API directly.
4. Real-time connection data comes through the WebSocket, processed in `store/connections.ts` and `store/connHistory.ts`.

### Key directories

| Path | Purpose |
|---|---|
| `src/api/` | Axios instance setup, WebSocket client, all API call functions |
| `src/store/` | Per-feature reactive state: `proxies`, `connections`, `connHistory`, `settings`, `overview`, `rules`, `logs`, `setup`, `smart` |
| `src/views/` | One file per route (ProxiesPage, ConnectionsPage, OverviewPage, …) |
| `src/components/` | Feature-scoped subfolders (`proxies/`, `connections/`, `common/`, etc.) |
| `src/composables/` | Reusable composition functions (15 hooks for things like speed formatting, WebSocket lifecycle, keyboard shortcuts) |
| `src/helper/` | Pure utilities: theme switching, notifications, IndexedDB wrapper, IP labels, format helpers |
| `src/i18n/` | Locale files; `vue-i18n` is set up in `main.ts` |
| `src/types/` | Shared TypeScript types for Clash API responses |

### Routing

Routes are nested under a `HomePage` shell (sidebar + layout). The `/setup` route stands alone. Router guards in `src/router/index.ts` redirect to `/setup` when no backend is configured.

### Settings & theming

`src/store/settings.ts` holds all user preferences (theme, font family, language, background image, feature flags). Theme is applied at the document root via CSS variables driven by DaisyUI themes. Font variants are selected at build time and also switchable at runtime.

### Charts & visualizations

ECharts (`echarts`) is used for traffic graphs and topology. For topology node overlays, HTML `<div>` elements are positioned over the canvas using computed pixel coordinates — see the recent commits for context. Avoid mixing ECharts graphic API elements with these HTML overlays.

### State management note

There is no Vuex/Pinia. State is plain `ref`/`reactive` objects exported from store files and imported by components. Persistence uses `useStorage` from VueUse (wraps localStorage). Connection history beyond the WebSocket window is kept in IndexedDB via `src/helper/idb.ts`.
