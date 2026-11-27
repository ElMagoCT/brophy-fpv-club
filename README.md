# Brophy FPV Club — public dashboard

A one-page public site showing the club sim lab's **opening hours**, the **pilot
leaderboard**, the **YouTube playlist** and three **randomly picked videos** from
it. Anyone can open it, any time, from any device. Reading needs no login
(pilot sign-in, when the API turns it on, is below). It is hosted on
**GitHub Pages** (https://elmagoct.github.io/brophy-fpv-club/): a push to
`main` publishes, so work on a branch. Pilot names, website progress, awards and
submissions come from the club API (`../brophy-fpv-club-api`, a set of Netlify
Functions); everything else is static files.

It is the outward-facing companion to the kiosk in `C:\BrophyUAV` — read that
folder's `CLAUDE.md` first if you are touching either side.

```
C:\BrophyUAV\data\profiles.json  ─┐
C:\BrophyUAV\data\schedule.json   ├─> Publish-Dashboard.ps1 ─> data.json ─> git push
C:\BrophyUAV\config.json          │        (scheduled task,      (this repo)      │
C:\BrophyUAV\index.html          ─┘         every 15 min)                         v
                                                                         GitHub Pages
                                                                                  │
                                                          index.html fetches data.json
```

**Nothing on this site is live.** It reads one snapshot file. The clock in the
"open now / closed" lamp *is* live, because every opening window in the snapshot
carries an absolute instant, so the page can compare it to the visitor's clock
without knowing anything about Phoenix time.

> **The lab's timezone is pinned in the exporter, not read off the kiosk PC.**
> That machine is set to Pacific while the school is in Phoenix. In August the
> two agree; from November they differ by an hour, and an exporter trusting the
> machine would publish every window an hour early all winter. It resolves
> against `US Mountain Standard Time` (Arizona, no DST) instead. Do not "simplify"
> that back to `[TimeZoneInfo]::Local`.
>
> This protects the *website*. The kiosk itself still has the same latent bug —
> see the tail of `C:\BrophyUAV\CHANGELOG.md`.

---

## Hosting

GitHub Pages serves `main` as is: no build step. `netlify.toml` is left over
from the first Netlify setup (2026-08) and is not used by Pages. The kiosk's
`Publish-Dashboard.ps1` pushes `data.json` to `main`, so `git pull` before you
work. Only the API lives on Netlify (site `brophy-fpv-club-api`).

## Names: the roster (2026-11-26)

A pilot is one entry on the club roster, `{slug, name, aliases}`, read from
`GET /api/roster`. `slug` is the pilot's permanent key; `aliases` are other
slugs that are the same person. The roster is the list of names in every
picker. Nobody types a new name into a picker any more: new pilots add
themselves on `/join/` (the QR on the sims points there), which posts
`{first, last}` to `POST /api/roster`.

- `config.js` holds the API address (`FPV.API`), the Join address and
  `FPV.post`, the one helper every pilot-side POST goes through (progress,
  submissions, join). On localhost, `localStorage['fpv.dev.api']` points the
  site at a local mock.
- Pilot sign-in (2026-11-26) follows `GET /api/auth/config` at run time, so
  turning it on is an API change only (API README, "Login"). With mode `off`
  (today) the site reads that config once on Join and when the profile panel
  opens, and nothing else changes: no script, no header, no login UI.
  With `optional` or `required`:
  - Join opens on one Sign in with Google button (Google's script is injected
    then, `hd` from the config, no One Tap). A new account fills the name from
    Google and runs the usual roster checks, then claims the entry or joins and
    claims in one tap. `optional` keeps "or type your name"; `required` has no
    typing path. If Google's script is blocked or the account is refused, the
    page offers the PIN path (a mentor's one-time code, then username + PIN).
  - `auth.js` is that UI (Google button, PIN form, the sign-in sheet). config.js
    loads it only when the mode is on.
  - The token is in localStorage `fpv.auth.v1` (sessionStorage when "Shared
    computer" is ticked, desktop only). `FPV.post` sends `X-Pilot-Token` only
    when there is a token and the mode is on.
  - A `401 login` / `403 not-you` on a pilot write keeps the write in
    `fpv.outbox.v1` (kept a week), opens the sign-in sheet and sends it after
    sign-in; the caller's promise gets that answer.
  - The profile panel shows Sign in, or Signed in + Sign out, only when the
    mode is on.
- `roster.js` loads and caches the roster (`fpv.roster.v1`). If the API cannot
  be reached it falls back to the names in `data.json`, silently. It matches
  `data.json` rows to entries by slug or alias (two rows that are one pilot
  show as one), and reads a pilot's awards, progress and submissions under the
  key and every alias.
- The device's pilot stays `fs.pilot.v1 = {name, slug}` with slug = the roster
  key. A saved name that is an alias follows its entry on the next load.
- Every name is escaped or set with `textContent`: roster names come from an
  open form.

## The other pages

| Path | What it is |
|---|---|
| `join/` | **Join** (2026-11-26): first name + last initial, a live preview of the name as the sims show it, the roster as tap-your-name chips (an exact match turns the button into "That's me", no write). A taken name asks "Is that you?"; "Not me" opens the box to three letters of the last name. Phone first |
| `groundschool/` | the course app (same as the kiosk's), no longer a page of its own: Flight School opens one lesson at a time in a frame as `groundschool/?lesson=<id>`; the bare URL redirects to `flightschool/`. A badge quiz opens on a **Watch** tab with the badge's club video once that video is on Drive (2026-11-25). `gs-videos.js` is new and the kiosk needs it too |
| `pilot-path/` | **Pilot Path** (was Flight School until 2026-10-10) — the whole badge curriculum (20 counted badges in three tiers plus 4 bonus badges that do not count; quiz, bench and witnessed badges; a time estimate on each), with a pilot picker so progress is per pilot. `badges.js` is the one badge catalogue the site uses; keep it in step with the kiosk's `config.json` catalogue. Progress merges the kiosk snapshot (earned badges, hours), Ground School lessons done on this device, and bench-step ticks made on the page. Since 2026-11-25 each card leads with the badge's club video (Google Drive, `groundschool/gs-videos.js`: the manifest and the one tap-to-load player every page and the course app use) and a **Take the quiz** button; the older lessons, YouTube how-tos and tips are under a closed **Resources** group. Sim Flight (`record: true`) is proven by a minute recorded on the kiosk and passed in the console |
| `flightschool/` | redirect to `pilot-path/` for old links; **`flightschool/badges.js` stays here** - it is still the badge catalogue |
| `progression/` | redirect to `pilot-path/` — kept because the printed posters' QR codes point here |
| `posters/` | the seven 11×17 posters above the simulators (the ad, the Flight Clearance sheet, the four Pilot Path map sheets, the how-to), as PDFs with PNG previews, plus a printing page. **Sources in `posters/src/`** — see below |
| `clearance/` | **Flight Clearance** (2026-10-20) - one page, two things, each a status card under the title that changes colour: the **Brophy Drone Certification** and **permission from Mr. Burr**. The certification is four badges, tier `cl` in `badges.js` (never counted, never a tier), rendered compact and collapsed like the Pilot Path's, tinted amber while a submission waits and green once approved: **FAA TRUST** (a photo or PDF of the certificate), **Safe Flight** (lessons + quiz, moved out of Tier 0), the **Pilot Agreement** (the terms on the card - `TERMS` in the script - and `clearance/agreement.html`, a one-page printable paper the pilot AND a parent sign, photographed and reviewed) and the **Drone Portfolio** (every drone the pilot may fly: "Add a drone" first, then the club's `FS.CLUB_DRONES` faded with an "Earn badge" link until their checkpoint is on file, then the pilot's own - picture, name, specs and a Google Drive flight video; `clearance.js` checks the link is public via Drive's thumbnail, the API stores it with the photo submission, the console's Review tab plays it and Pass approves that drone). Permission is Mr. Burr's Google Form, embedded; he answers by email, so the page never shows a yes. A certified pilot sees the form first, then drones, then badges; everyone else the other way round (the form is never hidden). `clearance.js` is the shared status logic. Split out of the old "FPV Certification Test" after Mr. Burr's and Mr. Reasy's replies |
| `clearance/terms/` | the **Pilot Agreement terms** as a page of their own (2026-10-20 evening); the signing paper `clearance/agreement.html` is one black-and-white Letter sheet whose first tick box says the terms were read, with `clearance/qr-terms.svg` (python `qrcode`) pointing here. `site.js` puts Flight Clearance, the terms and Mr. Burr's request form in every page's footer |
| `fly/` | redirect to `clearance/#permission` - it was **Request to fly** (2026-10-15 to 10-20, Mr. Burr's form behind a Tier 1 gate); the QR codes and old links still land |
| `admin/` | the instructor console (signed commands to the kiosks). `admin/#approvals` is the Flight School sign-off view: pick pilot + badge, Approve files a signed decision both kiosks pull; `admin/` (default) is photo review |

### Rebuilding the posters

Everything is in `posters/src/`:

```bash
cd posters/src
python3 drones.py              # draws img/drone-*.svg and img/gate-*.svg (the aircraft and the race gates)
#   scenery.py is imported by gen_map.py: the city-to-mountains backdrop behind the trail
python3 gen_map.py             # writes 03..06, the four Pilot Path sheets
python3 gen_cert.py            # writes 02-cert, the Flight Clearance poster (clean white page, not the trail style)
#   16-qr-codes.html is hand-written: every QR code with its address (qr-*.svg, python segno, path id="q")
python3 gen_dock.py            # writes 08..15, the drone dock sheets (4 drone classes x 8.5x11 and 7x11)
python3 build.py               # renders every NN-*.html to ../NN.pdf and ../preview/NN.png
```

Needs Google Chrome (headless) and, for the PNGs, macOS's `qlmanage`. Fonts are
the kiosk's self-hosted woff2 files, served over a throwaway local HTTP server
because Chrome refuses `@font-face` from `file://`. Posters 01 (the ad, white
background) and 07 (the monitor strips: one sheet cut in half vertically, the four
sim steps on one side and the elmagoct.github.io/fpv short link on the other)
are hand-written HTML. The five trail sheets are
generated and **read every badge from `flightschool/badges.js`** (via node), so
a badge change is: edit badges.js, `python3 gen_map.py`, `python3 build.py`.

Trail layout (2026-10-23): one trail across the four Pilot Path sheets - down
sheet 1 from START, up sheet 2, down sheet 3, up sheet 4 to the FINISH (teach
others). Cards hang off the dotted trail on alternating sides, a little varied
in width, drifted and tilted (seeded, so rebuilds are identical), and list only
what passes the badge. A tier's checkpoint is a race **gate** box at the end of
the sheet with the drone it unlocks flying through, listing the checkpoint's
own requirements only; the gate picture (the drone flying through a race gate)
stands in the landscape beside it and the trail runs out of the box, through the
gate and off the edge. No titles, headers, legends, QR or footers: every word
is inside a box, since the sheets hang right above the sim. Behind everything a
bold ink landscape (`scenery.py`, no grid) goes from a neon city on sheet 1 to
mountains and pines on sheet 4, one continuous panorama; the gate pictures are
rendered at a -45 deg yaw so the drone flies screen-right along the trail, and
the trail fades out before each drone and back in after it. The sheet's own script spaces the
cards with real heights, mirrors them on "up" sheets, scales the text down a
step if crowded, draws the trail with one loop in the biggest gap, and sets
`data-trail="ok k=…"` or `"overflow Npx"` on `<body>` before Chrome prints.
One or two more drones ride the trail on each sheet (`extras` in SHEETS; the
sheet's script puts each in the longest clear gap, rotated to the trail's
direction, and the dots fade under every drone through one SVG mask); the two
5-inch builds differ (teal Axis-style and an orange one with an action camera).

The aircraft are not clip art: `drones.py` is a small renderer (one yaw and
elevation for everything, affine projection, shaded walls, stacked slices for
the curved parts) that draws the radio, the Meteor 75 Pro, the Pavo 20 Pro, the
Cinebot and a 5-inch from the product photos at their real wheelbases, so they
grow sheet by sheet. The drone docks (pin a sheet up, write your name, hang the
drone on pins through the ⊕ marks) come from `CLASSES` in `gen_dock.py` — the
outline is drawn in millimetres so it prints at actual size, or scaled with a
note when the frame is wider than the paper.

Tier numbering on the posters and the pilot-path page is the club's: **the
simulator is Tier 0 and the Meteor is Tier 1**. The grant proposal numbers the
same tiers 1–3, so its "Gate 1" badges are the Tier 0 badges here.

---

## How it updates

`Publish-Dashboard.ps1` runs every 15 minutes and **only commits when the data
actually changed**, ignoring its own timestamp. A room that is shut all weekend
produces zero commits and zero Pages builds; an afternoon of flying produces
one commit per 15-minute slice that saw activity.

If a push fails — network down, token expired — the commit is already made
locally and the next run carries it. Nothing is lost, and `publish.log` says what
happened.

Run it by hand any time:

```powershell
C:\BrophyUAV\Publish-Dashboard.ps1            # export, commit, push if changed
C:\BrophyUAV\Publish-Dashboard.ps1 -NoPush    # just rewrite data.json
C:\BrophyUAV\Publish-Dashboard.ps1 -Force     # push even if nothing changed
```

---

## What is and is not published

`data.json` is a **derived export**, not a copy of `profiles.json`. It carries:

- display name, total ms, per-sim ms, ground-school percentage and lesson count,
  and a `lastSeen` stamp (used only for the "flying this week" tile)
- the next 28 days of resolved opening windows
- the sim list and the 25 embeddable video ids

It deliberately does **not** carry profile ids, per-lesson timings, scores,
attempt counts, or `created` stamps. If you add a field to the payload, ask
whether it belongs on a URL a stranger can open.

### Changing how names appear

Names are currently published **exactly as typed at the kiosk**, which in
practice is already `First L.` format. To change that, pass `-NameMode`:

| `-NameMode` | `Micah Thompson` becomes |
|---|---|
| `full` *(current)* | `Micah Thompson` |
| `firstlast` | `Micah T.` |
| `initials` | `M.T.` |

To make it permanent, edit the `$NameMode` default at the top of
`C:\BrophyUAV\Publish-Dashboard.ps1`, or add `-NameMode initials` to the task's
action. Then run with `-Force` so the change is published immediately.

---

## Editing the site

`index.html` is the whole site — markup, CSS and JS in one file, no build step,
same as the kiosk. Open it, edit it, commit it.

To preview locally you need real HTTP; `file://` breaks the `fetch` of
`data.json`. Any static server will do.

Design rules carried over from the kiosk, and worth keeping:

- **The grid is the desk; the boxes on it are white.** `--glass` is the field the
  blueprint grid is printed on. `--glass-2` is the opaque white of anything you
  read. Use `background-color:`, never the `background:` shorthand, on desk
  surfaces — the shorthand resets the grid image out from under them.
- **The two pencil faces are for the wordmark only.** Cabin Sketch and Architects
  Daughter appear in the `h1` and the stamp. Nothing read word by word is set in
  them.
- **Nothing smaller than 13px.**
- Fonts come from Google Fonts here, unlike the kiosk, which self-hosts them
  because the school's filtered network made a render-blocking font request stall
  every browser start. A public site has no such constraint.

### The reel

Only the **25 embeddable** videos are in the snapshot. Seven of the 32 in the
playlist have embedding switched off by their owners and answer Error 150 — the
kiosk measured this with `C:\BrophyUAV\concepts\_yt-scan.html`, and a
server-side fetch cannot detect it because YouTube only sends the flag to a real
browser.

The exporter parses the list straight out of the kiosk's `index.html`, so there
is one source of truth. **If the playlist changes, re-run the scanner and update
`var REEL` in `C:\BrophyUAV\index.html`** — the dashboard follows automatically.

Posters are `i.ytimg.com` thumbnails and the player only loads on a tap. If the
thumbnail is blocked, the frame falls back to a drawn panel and the video still
plays.

---

## Troubleshooting

| Symptom | Where to look |
|---|---|
| Site shows old numbers | `publish.log`. Then `git -C C:\BrophyUAV-web log --oneline -5` — did a commit even happen? |
| `git push failed` in the log | The cached token is gone. Push once by hand to re-authenticate. If it only fails from the task and not by hand, re-run `Install-DashboardTask.ps1 -Interactive`. |
| A PowerShell window flashes every 15 min | The task is running Interactive. Re-run `Install-DashboardTask.ps1` without `-Interactive` to go back to hidden S4U. |
| "Could not load the lab snapshot" on the site | `data.json` is missing from the deploy, or you are opening `index.html` over `file://`. |
| Hours look wrong | The snapshot is only as right as `C:\BrophyUAV\data\schedule.json`. Check there first, and read `SCHEDULE.md`. |
| Wrong day marked "today" | The snapshot's day 0 is whatever day the kiosk was on when it last published. If the kiosk has been off for a week, the whole window list is stale — run the publish by hand. |

---

## Files

| | |
|---|---|
| `index.html` | the entire site |
| `data.json` | the generated snapshot. **Do not hand-edit** — the next publish overwrites it |
| `config.js`, `roster.js` | the API address + POST helper, and the roster (see "Names: the roster") |
| `site.js`, `site.css` | the shared top bar, profile picker, footer and dark palette |
| `netlify.toml` | left from the Netlify days; GitHub Pages ignores it |
| `robots.txt` | crawlable; the page is meant to be found |
| `pilot-path/`, `posters/` | the badge curriculum and the printed posters — see "The other pages" |
| `publish.log` | what the exporter did. Git-ignored |
| `.snapshot-hash` | local change-detection marker. Git-ignored |
| `C:\BrophyUAV\Publish-Dashboard.ps1` | the exporter |
| `C:\BrophyUAV\Install-DashboardTask.ps1` | registers/removes the scheduled task |
