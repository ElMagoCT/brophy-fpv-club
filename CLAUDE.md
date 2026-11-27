# Brophy FPV Club — notes for Claude

Formerly "Brophy UAV" (renamed 2026-10-12). Site: https://elmagoct.github.io/brophy-fpv-club/
(repo ElMagoCT/brophy-fpv-club, pushes publish). The kiosk pushes `data.json`, so **pull first**.
Kiosk: `../brophy-fpv-club-kiosk/` (has its own CLAUDE.md); API: `../brophy-fpv-club-api/`
(brophy-fpv-club-api.netlify.app).

- Kiosk-side identifiers (`C:\BrophyUAV*`, `BrophyUAV.exe`, `brophy-uav.ico`,
  scheduled-task names) were kept on purpose. Never create a repo under an old
  `brophy-uav-*` name: the kiosks' clones still use GitHub's rename redirect.
  Old site URLs redirect via the user-site repo ElMagoCT/elmagoct.github.io
  (`elmagoct.github.io/`, map in `redirect.js`).
- Dark mode (2026-10-18): `theme.js` in `<head>` sets `<html data-theme>` from
  localStorage `fpv.theme.v1` (light/auto/dark switch appended to `<footer>`); the
  dark palette is the block at the end of `site.css`. Only Home, Fly, Pilot Path -
  Ground School and the admin console have their own stylesheets.
- Posters (`posters/src/`, 2026-10-23): `drones.py` renders the drones/gates as SVG,
  `gen_map.py` writes 02-cert + 03-06 from `flightschool/badges.js`, `build.py` makes
  the PDFs (run it in the background: Chrome can take >2 min for six sheets).
- Roster (2026-11-26): names come from `GET /api/roster` via `roster.js` (falls back to
  `data.json` names); new pilots add themselves on `join/` (the sims' QR). No free-text
  name entry anywhere. `config.js` = API address + `FPV.post`, the one helper for every
  pilot-side POST (it adds `X-Pilot-Token` and keeps refused writes in an outbox).
  `fs.pilot.v1.slug` is the roster key; look a pilot up with
  `Roster.keys/row/awards/progress/submissions` so aliases count.
- Login (2026-11-26): driven only by `GET /api/auth/config`. Mode off must stay byte-for-byte
  the old site: no `auth.js`, no Google script, no header (FPV.post reads the config only
  when a token exists). `auth.js` is injected by `FPV.ui()`. Don't name a local function
  `google` in auth.js (it shadows the GIS global). Join is Google-first when the config has
  Google; shapes in the API's `netlify/functions/auth.mjs`.
- Escape every name (open form). Pushing `main` publishes: work on a branch.
  Local test: serve the folder, set `localStorage['fpv.dev.api']` to a mock on localhost.
