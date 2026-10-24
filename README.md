# Brophy FPV Club — public dashboard

A one-page public site showing the club sim lab's **opening hours**, the **pilot
leaderboard**, the **YouTube playlist** and three **randomly picked videos** from
it. Anyone can open it, any time, from any device. No login, no server.

It is the outward-facing companion to the kiosk in `C:\BrophyUAV` — read that
folder's `CLAUDE.md` first if you are touching either side.

```
C:\BrophyUAV\data\profiles.json  ─┐
C:\BrophyUAV\data\schedule.json   ├─> Publish-Dashboard.ps1 ─> data.json ─> git push
C:\BrophyUAV\config.json          │        (scheduled task,      (this repo)      │
C:\BrophyUAV\index.html          ─┘         every 15 min)                         v
                                                                            Netlify build
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

## Finishing the setup

Everything in this folder is built and committed. What is left needs your GitHub
account, which is why it is not done.

> **Run these in PowerShell, not Git Bash.** In bash a Windows path gets its
> backslashes eaten — `C:\BrophyUAV-web` arrives as `C:BrophyUAV-web` and git
> answers `cannot change to 'C:BrophyUAV-web'`. If you would rather use bash,
> write the path with forward slashes: `git -C /c/BrophyUAV-web …`.

### 1. Sign in to GitHub, and create the repo

As of 2026-08-23 Chrome on this machine is **not signed in to GitHub** — that is
the actual blocker, and it is the one step nobody can do for you.

Then make a **new, empty** repo called `brophy-fpv-club` (no README, no
.gitignore — this folder already has both). Public or private both work; Netlify
can build from either.

Then, from PowerShell:

```powershell
git -C C:\BrophyUAV-web remote add origin https://github.com/YOUR-USER/brophy-fpv-club.git
```

### 2. Push once, by hand

The first push has to be interactive, because it is what signs git in to GitHub.
A browser window opens, you approve, and Git Credential Manager caches the token
in Windows Credential Manager for this user. Every later push is silent.

```powershell
git -C C:\BrophyUAV-web push -u origin main
```

### 3. Point Netlify at it

In Netlify: **Add new site → Import an existing project → GitHub →** pick the
repo. Netlify reads `netlify.toml` and needs no other answers:

| | |
|---|---|
| Build command | *(none)* |
| Publish directory | `.` |

Deploy. You get a `something-something.netlify.app` URL; rename it under
**Site configuration → Site details** if you want something you can say out loud.

### 4. Turn on the every-15-minutes publish

```powershell
C:\BrophyUAV\Install-DashboardTask.ps1
Start-ScheduledTask -TaskName 'Brophy FPV Club Dashboard Publish'
Get-Content C:\BrophyUAV-web\publish.log -Tail 20
```

That is it. From then on the kiosk pushes a fresh snapshot whenever the numbers
change, Netlify rebuilds in a few seconds, and the site is current.

## The other pages

| Path | What it is |
|---|---|
| `groundschool/` | the course app (same as the kiosk's), no longer a page of its own: Flight School opens one lesson at a time in a frame as `groundschool/?lesson=<id>`; the bare URL redirects to `flightschool/` |
| `pilot-path/` | **Pilot Path** (was Flight School until 2026-10-10) — the whole badge curriculum (18 badges in four tiers plus 4 bonus badges that do not count; quiz, bench and witnessed badges; a time estimate on each), with a pilot picker so progress is per pilot. `badges.js` is the one badge catalogue the site uses; keep it in step with the kiosk's `config.json` catalogue. Progress merges the kiosk snapshot (earned badges, hours), Ground School lessons done on this device, and bench-step ticks made on the page |
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
python3 gen_map.py             # writes 02-cert (Flight Clearance) and 03..06 (the four Pilot Path sheets)
python3 gen_dock.py            # writes 08..15, the drone dock sheets (4 drone classes x 8.5x11 and 7x11)
python3 build.py               # renders every NN-*.html to ../NN.pdf and ../preview/NN.png
```

Needs Google Chrome (headless) and, for the PNGs, macOS's `qlmanage`. Fonts are
the kiosk's self-hosted woff2 files, served over a throwaway local HTTP server
because Chrome refuses `@font-face` from `file://`. Posters 01 (the ad, white
background) and 07 (the how-to) are hand-written HTML. The five trail sheets are
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
gate and off the edge. No titles, legends or footers; a "the whole path" strip
repeats the four tiers and three gates with YOU ARE HERE. Behind everything a
bold ink landscape (`scenery.py`, no grid) goes from a neon city on sheet 1 to
mountains and pines on sheet 4, one continuous panorama; the gate pictures are
rendered at a -45 deg yaw so the drone flies screen-right along the trail, and
the trail fades out before each drone and back in after it. The sheet's own script spaces the
cards with real heights, mirrors them on "up" sheets, scales the text down a
step if crowded, draws the trail with one loop in the biggest gap, and sets
`data-trail="ok k=…"` or `"overflow Npx"` on `<body>` before Chrome prints.
02-cert is the same machinery for the four badges of the Brophy Drone
Certification (tier `cl`), ending in the CLEARED TO FLY gate.

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
produces zero commits and zero Netlify builds; an afternoon of flying produces
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
| `netlify.toml` | publish dir and cache headers. No build command, on purpose |
| `robots.txt` | crawlable; the page is meant to be found |
| `pilot-path/`, `posters/` | the badge curriculum and the printed posters — see "The other pages" |
| `publish.log` | what the exporter did. Git-ignored |
| `.snapshot-hash` | local change-detection marker. Git-ignored |
| `C:\BrophyUAV\Publish-Dashboard.ps1` | the exporter |
| `C:\BrophyUAV\Install-DashboardTask.ps1` | registers/removes the scheduled task |
