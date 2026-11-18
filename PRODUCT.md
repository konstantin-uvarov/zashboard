# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **The owner, running the home network.** They check and steer the sing-box proxy on the home router (GL-MT6000, OpenWrt): which protocol or outbound is active, which devices use how much traffic, which route rules hit, and whether a rule should be switched off. Typical moments are a quick look when something feels slow and a deeper look at history or topology when debugging routing.
- It's a single-household, private tool, served from the router (`192.168.8.1:9090/ui/`) on the local network. It's not public and not sold.

## Product Purpose

A personal fork of [Zephyruso/zashboard](https://github.com/Zephyruso/zashboard), the dashboard for Clash/Mihomo/sing-box cores, tuned for this home's sing-box setup. Success means the owner can see what the network is doing and fix routing in a few clicks, without SSH.

## Positioning

Upstream zashboard plus what this home needs: a sing-box CGI bridge (rules with inline comments, rule toggles, backend restart), a Stats page (device speeds, traffic distribution, connection topology, rule hits), richer connection history, and device names instead of bare IPs.

## Operating Context

- Opened on desktop and phone, inside the home network only.
- Device names come from a static DHCP label map, so every IP reads as `192.168.x.x (Device Name)`.
- History survives reloads through IndexedDB.
- Upstream locales: `en`, `ru`, `zh`, `zh-tw`. Custom strings go at the end of `src/i18n/en.ts`.

## Capabilities and Constraints

- **Stay close to upstream.** Upstream's look (Vue 3, Tailwind, DaisyUI v5 themes) and structure are the design authority. Fork changes stay small and additive so `upstream` merges stay easy.
- Fork-only files (agent config, ignores) must survive upstream syncs.
- Versions follow `{upstream-version}-{label}{n}` (e.g. `3.5.1-sb2`).
- sing-box-only features (CGI rules, restart) must degrade cleanly on other backends.

## Brand Commitments

- The upstream name and attribution (zashboard by Zephyruso, MIT licence) stay; this fork doesn't rebrand.

## Evidence on Hand

- One household's live network. **No external users or usage data.** Don't invent any.

## Product Principles

1. **Glanceable first.** The state of the network (active outbound, speeds, busy devices) reads in seconds.
2. **Names, not numbers.** Show devices by name everywhere an IP appears.
3. **Upstream-shaped.** Extend the way upstream would; don't restyle what upstream owns.
4. **Safe controls.** Anything that changes routing or restarts the backend is clear and deliberate.

## Accessibility & Inclusion

- Target: **WCAG 2.2 AA** for the fork's own screens (Stats page, connection history additions). Upstream screens follow upstream.
