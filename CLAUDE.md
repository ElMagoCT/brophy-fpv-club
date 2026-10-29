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
