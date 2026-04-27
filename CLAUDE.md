# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # Minify JS + compile SCSS → dist zip + static/
npm run build-js     # JS only (produces static/script.min.js)
npm run build-css    # SCSS only (produces static/theme.min.css)
npm run watch        # Dev mode: watch JS + SCSS, sync to local FreshRSS folder
```

`npm run watch` reads `.env` (copy `.env.example`) for `FRESHRSS_DEV_FOLDER` and `FRESHRSS_DEV_FOLDER_FILE_SYNC=true` to sync files into a local FreshRSS install automatically.

There are no tests (`npm test` exits 1 by default).

## Architecture

Youlag is a **FreshRSS extension** — a PHP extension that injects vanilla JS and SCSS into a FreshRSS/Mapco-themed interface. There is no module system; all JS functions are global.

### Entry points

| File | Role |
|------|------|
| `extension.php` | PHP extension class: registers hooks, reads/saves settings, outputs hidden DOM elements |
| `configure.phtml` | Extension settings page rendered in FreshRSS admin UI |
| `metadata.json` | Extension name/version (version injected into built JS at build time) |

### JS source files (concatenated + minified in order by `scripts/build.js`)

| File | Role |
|------|------|
| `src/global.js` | `app` global: all state (`app.state`), selectors (`app.frss`), type definitions (`app.types`), CSS id/class maps (`app.modal`, `app.ui`) |
| `src/utilities.js` | Pure helpers: URL parsing, page detection (`isFeedPage`, `isLayoutVideo`, `isLayoutArticle`), state getters/setters, date formatting, API fetches |
| `src/helpers.js` | DOM helpers: `extractFeedItemData()`, chapter parsing, tag API calls, DeArrow thumbnail fetching |
| `src/ui.js` | Core UI: click listeners, toolbar, sidebar, body class management, swipe gestures, video card rendering |
| `src/ui-modals.js` | Theater modal: `handleActiveVideo()`, `handleActiveArticle()`, `renderModalVideo()`, `closeModalVideo()`, `closeArticle()`, video queue, tags modal |
| `src/ui-video-control.js` | YouTube IFrame API: chapter rendering, playback position tracking, chapter navigation |
| `src/ui-modes.js` | Miniplayer/fullscreen toggle logic and swipe-to-miniplayer |
| `src/forms.js` | Settings page JS behavior |
| `src/events.js` | `init()` orchestrator + `initialVideoState()` for direct video links |
| `src/db.js` | IndexedDB wrapper for caching |
| `src/debug.js` | Debug panel (only loaded when debug mode is on) |

### PHP → JS data flow

PHP cannot call JS directly; settings are written to the page as hidden `<div data-yl-*>` elements via `registerHook('nav_entries', ...)`. JS reads these at init time. Pattern used for every setting:

```php
// extension.php
public function setColorScheme(): string {
    return '<div id="yl_color_scheme" data-yl-color-scheme="' . $scheme . '"></div>';
}
```

```js
// JS reads it
const scheme = document.getElementById('yl_color_scheme')?.getAttribute('data-yl-color-scheme');
```

CSS hides these elements via the `[data-yl-*] { display: none }` block at the bottom of `theme.scss`.

### CSS / SCSS (`src/theme.scss`)

Single file compiled to `static/theme.min.css`. Key sections (in order):

1. **`:root` variables** — spacing, typography, color variables. Color vars default to **light mode**; `@media (prefers-color-scheme: dark)` and `html.yl-scheme-dark`/`html.yl-scheme-light` override them for explicit theme control.
2. **MAPCO THEME DARK MODE** (lines ~2200–3980) — overrides FreshRSS/Mapco's default light styles to dark. Contains both color rules and structural layout rules (fixed sidebar, nav_menu positioning). This entire section always applies; colors adapt via CSS variables.
3. **Youlag theater modal / miniplayer / tags modal / settings** — Youlag-specific UI built on top of FreshRSS.
4. **LIGHT MODE OVERRIDES** (end of file) — a SCSS mixin `yl-light-mode-overrides` applied to both `@media (prefers-color-scheme: light)` and `html.yl-scheme-light`.

### Color scheme system

Three sources of truth, in order of precedence (highest last wins in CSS):
1. `:root` — light defaults
2. `@media (prefers-color-scheme: dark)` — OS preference
3. `html.yl-scheme-dark` / `html.yl-scheme-light` — explicit Youlag setting (applied by `applyColorScheme()` in `events.js` at init time)

The explicit setting is stored server-side as `yl_color_scheme` (`'auto'`/`'light'`/`'dark'`) and written to the DOM via `nav_entries` hook.

### Key CSS variables

| Variable | Purpose |
|----------|---------|
| `--yl-color-body-background` | Page background |
| `--yl-color-text-default` | Body text |
| `--yl-color-surface-1` | Button/input bg (dark: `#303136`, light: `#e4e4e8`) |
| `--yl-color-surface-2` | Hover state (dark: `#424348`, light: `#d8d8dc`) |
| `--yl-color-surface-0` | Modal content bg (dark: `#1f1f1f`, light: `#f0f0f4`) |
| `--yl-color-modal-bg` | Theater modal bg (dark: `#060606`, light: `#ffffff`) |
| `--yl-color-gradient-active` | Active/selected button gradient (always blue) |
| `--yl-topnav-height` | Top header height (57px desktop, 54px mobile) |

### Key non-obvious patterns

- **FreshRSS forces Mapco theme**: `extension.php` line 120 sets `theme = 'Mapco'` unconditionally, overriding the user's FreshRSS theme picker. The Youlag settings page exposes its own Color scheme option instead.
- **All JS is global**: no imports/exports. Execution order matters — `build.js` concatenates files in a fixed order.
- **`stopImmediatePropagation` required for keydown**: FreshRSS registers its own `keydown` listener on `document`. `stopPropagation()` does not prevent sibling listeners; `stopImmediatePropagation()` is required for J/K nav keys.
- **`--yl-three-pane-list-width` CSS variable**: drives both `#stream` width and article pane position in three-pane layout. Set by JS and saved to localStorage.
- **`body.youlag-inactive` centering**: FreshRSS applies `margin: 0 auto` to `#stream` in article mode; three-pane overrides need `margin: 0 !important` to suppress it.
- **Loading overlay**: `#global:after` covers the feed with a blurred backdrop until `body.youlag-loaded` is added by `removeYoulagLoadingState()` at the end of `init()`, giving JS time to apply classes (e.g. color scheme) before content is visible.
