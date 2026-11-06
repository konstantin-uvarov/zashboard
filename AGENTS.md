# zashboard

Personal fork of [Zephyruso/zashboard](https://github.com/Zephyruso/zashboard) — a Vue 3 + TypeScript dashboard for Clash/Mihomo/sing-box proxy cores.

## Repo overview

- **Upstream**: `Zephyruso/zashboard` (tracked as remote `upstream`)
- **This fork**: adds sing-box CGI bridge, Stats page, Connection History enhancements, and DHCP device labels on top of upstream
- **Stack**: Vue 3, TypeScript, Vite, Tailwind CSS, DaisyUI v5, ECharts, TanStack Table, VueUse, IndexedDB

## Custom modifications

### CGI bridge for sing-box (`src/api/index.ts`, `src/store/rules.ts`)

When the backend is sing-box, rules are fetched and managed via a shell CGI script (`sing-box-rules-api.sh`) instead of the standard Mihomo API. The CGI base URL is derived from the active backend's host and protocol.

- `fetchRulesCgiAPI` — fetches rules with payload and optional inline comments
- `toggleRuleCgiAPI` — enables/disables a rule by UUID
- `restartBackendCgiAPI` — triggers a backend restart via CGI

Rule comments are shown inline on rule cards (`src/components/rules/RuleCard.vue`).

The **Restart Backend** button in Settings is sing-box-only (`src/components/settings/backend/BackendSettings.vue`).

### Stats page (`src/views/StatsPage.vue`, route: `/stats`)

A dedicated analytics page combining:
- **Overview stats grid** — 6-cell summary (connections, memory, DL/UL totals and speeds); shown only on this page, not on the Overview page
- **Device Speed chart** — real-time per-device DL+UL line chart (`src/components/stats/DeviceSpeedCharts.vue`); data from `src/composables/deviceSpeed.ts`
- **Traffic Distribution** — horizontal bar chart by source IP / outbound / destination / process (`src/components/stats/TrafficPieChart.vue`)
- **Connection Topology** — Sankey diagram (`src/components/overview/TopologyCharts.vue`) with time range, metric, scale selectors, HTML value overlays, drag-to-pause, and persistent IndexedDB history
- **Rule Hit Count** — per-rule traffic breakdown

### Connection History (`src/components/overview/ConnectionHistory.vue`)

Enhanced from upstream with:
- Time-range filter (5 min / 30 min / 6 h / 1 day / all-time)
- Source IP colour dots per device
- Embedded Traffic Distribution chart
- Stat cells styled as light-grey rounded boxes (no shadow)

### DHCP labels (`src/helper/dhcpLabels.ts`, `src/helper/sourceip.ts`)

Static map of home-network devices. IPs are displayed as `192.168.x.x (Device Name)` throughout the UI. `getIPDisplayLabel(ip)` is the main helper used in charts and the source IP filter.

### IndexedDB persistence (`src/helper/indexeddb.ts`, `src/store/connHistory.ts`)

Topology flow data and connection history start times are persisted across sessions via IndexedDB so the Sankey diagram survives page reloads.

## Key files

| Path | Purpose |
|------|---------|
| `src/api/index.ts` | API layer — CGI functions appended after standard APIs |
| `src/store/rules.ts` | Rules store — CGI fetch with fallback for sing-box |
| `src/store/connHistory.ts` | Aggregated connection history + topo flow storage |
| `src/composables/timeRange.ts` | Shared time-range filter options and helpers |
| `src/composables/ipColorMap.ts` | Persistent IP → colour assignments |
| `src/composables/deviceSpeed.ts` | Per-device speed ring buffer |
| `src/helper/dhcpLabels.ts` | Static DHCP device name map |
| `src/helper/sourceip.ts` | IP label resolution with DHCP fallback |
| `src/i18n/en.ts` | English strings — custom keys appended at the end |

## Development

```bash
pnpm install
pnpm dev        # dev server
pnpm type-check # TypeScript check
pnpm build      # production build → dist/
```

## Creating a release

1. **Bump version** in `package.json` — format is `{upstream-version}-{label}{n}`, e.g. `3.5.1-sb2`

2. **Commit the bump**
   ```bash
   git add package.json && git commit -m "3.5.1-sb2"
   ```

3. **Build**
   ```bash
   pnpm build
   ```

4. **Create dist.zip**
   ```bash
   python3 -c "import shutil; shutil.make_archive('dist', 'zip', '.', 'dist')"
   ```

5. **Push main**
   ```bash
   git push origin main
   ```

6. **Create GitHub release**
   ```bash
   gh release create v3.5.1-sb2 dist.zip \
     --title "v3.5.1-sb2" \
     --target main \
     --notes "..."
   ```

`dist.zip` is gitignored — only attach it to the release, never commit it.

## Syncing with upstream

The `upstream` remote tracks `Zephyruso/zashboard`. To port a new upstream version, branch from `upstream/main` and re-apply custom modifications. See `back-up-personal-v2.6.8` for the previous-generation backup pattern.
