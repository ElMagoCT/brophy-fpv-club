#!/usr/bin/env python3
"""Generates the Pilot Path map sheets (03..06) and the Flight Clearance sheet (02).

    python3 gen_map.py          # writes 02-cert.html and 03-map-tier0.html .. 06-map-tier3.html
    python3 build.py 02-cert 03-map-tier0 04-map-tier1 05-map-tier2 06-map-tier3

Every word on a badge card comes from ../../flightschool/badges.js (read with
node), so the posters can never drift from the website. Change a badge there,
rerun this, rebuild.

Layout (2026-10-23, second pass on Micah's notes):
  - one trail across all four sheets. Sheet 1 runs DOWN from START at the
    top-left to Gate 1 at the foot; sheet 2 comes in at the bottom-left and
    climbs UP to Gate 2 at the top; sheet 3 runs down to Gate 3; sheet 4 climbs
    through the bonus badges to the FINISH: teach others.
  - the checkpoint is a race GATE box with the drone it unlocks flying through
    (img/gate-N.svg from drones.py). It lists the checkpoint's own requirements
    and nothing else. No big tier title: the gate is the headline.
  - cards hang off the trail on alternating sides, a little varied in width,
    drifted and tilted (fixed pseudo-random per sheet), and list only what
    passes the badge. No direction arrows: the numbered pins and the dotted
    trail carry the order.
  - the header shows what you fly in this tier (img/drone-*.svg) at one scale,
    so the fleet grows sheet by sheet; a "the whole path" strip repeats the
    four tiers and three gates with YOU ARE HERE.
  - 02-cert uses the same machinery for the four badges of the Brophy Drone
    Certification (tier 'cl'), ending in the CLEARED TO FLY gate.

The sheet's own script lays the cards out with their real heights, scales the
text down a step if crowded, draws the trail (with one loop in the biggest gap)
and sets <body data-trail> to "ok k=..." or "overflow Npx".
"""
import html, json, os, shutil, subprocess, sys
from drones import SPAN_MM, MODELS, Scene, GATES as GATE_SCENES, K as CAM_K
import math
CENTERS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'img', 'centers.json')))
from scenery import scenery, GY
import re

HERE = os.path.dirname(os.path.abspath(__file__))
BADGES_JS = os.path.normpath(os.path.join(HERE, '..', '..', 'flightschool', 'badges.js'))
PX_PER_MM = 0.8                     # the gate pictures: one scale on every sheet

# ----------------------------------------------------------------- the data
def load_fs():
    node = os.path.expanduser('~/.local/node-v24.19.0-darwin-arm64/bin/node')
    if not os.path.exists(node):
        node = shutil.which('node') or sys.exit('node is needed to read badges.js')
    js = ("global.window={};eval(require('fs').readFileSync(%s,'utf8'));"
          "var F=window.FS;process.stdout.write(JSON.stringify({TIERS:F.TIERS,TRACK:F.TRACK,"
          "BADGES:F.BADGES,LESSON_TITLES:F.LESSON_TITLES,PASS:F.PASS,SIM_HOURS:F.SIM_HOURS}))") % json.dumps(BADGES_JS)
    return json.loads(subprocess.run([node, '-e', js], capture_output=True, text=True, check=True).stdout)

def span(name):
    if name not in SPAN_MM:
        s = Scene(); MODELS[name](s); SPAN_MM[name] = s.bbox[2] - s.bbox[0]
    return SPAN_MM[name]

TRACK_COLOR = {'flight': 'var(--sky)', 'build': 'var(--amber)', 'know': 'var(--green)', 'crew': 'var(--violet)'}
TYPE_NAME = {'knowledge': 'Quiz', 'bench': 'Bench', 'witnessed': 'Witnessed', 'auto': 'Automatic'}

TIERS = [
  dict(id='t0', n=0, short='Simulator', fly='the five FPV sims in the IC, on the club radio', drones=['radio'], color='var(--sky)'),
  dict(id='t1', n=1, short='Meteor 75 Pro', fly='the club Meteor 75 Pro · sub-250 g whoop · indoors', drones=['whoop'], color='var(--violet)'),
  dict(id='t2', n=2, short='Pavo 20 Pro', fly='the Pavo 20 Pro · 2-inch cinewhoop · the first full-size airframe', drones=['pavo'], color='var(--rust)'),
  dict(id='t3', n=3, short='Event Pilot', fly='any Tier 2 airframe at a school event · Cinebot, 5-inch · always with a spotter', drones=['cinebot', 'five'], color='var(--green)'),
]
GATES = ['Meteor 75 Pro Certification', 'Pavo 20 Pro Flight', 'Event Pilot']   # the checkpoints, by name, gate 1..3

SHEETS = [
  dict(file='03-map-tier0', sheet=1, tier='t0', dir='down', scene=(0, .25),
       start=('Start', 'Add your name at the sim kiosk, then fly'),
       sticker='Bonus challenge: do all five in one community period and you fly that day',   # 2026-10-15, Micah
       gate=1, extras=['fly-whoop', 'fly-whoop-2']),
  dict(file='04-map-tier1', sheet=2, tier='t1', dir='up', scene=(.25, .5),
       came=('From sheet 1', 'Gate 1 passed: you fly the club Meteor'),
       gate=2, extras=['fly-pavo', 'fly-whoop']),
  dict(file='05-map-tier2', sheet=3, tier='t2', dir='down', scene=(.5, .75),
       came=('From sheet 2', 'Gate 2 passed: you fly the Pavo'),
       gate=3, extras=['fly-cinebot', 'fly-pavo-2']),
  dict(file='06-map-tier3', sheet=4, tier='t3', badges_from='el', dir='up', scene=(.75, 1),
       came=('From sheet 3', 'Gate 3 passed: you fly for the school'),
       finish=True, extras=[('fly-five-b', .9), 'fly-cinebot-2']),
]

# ----------------------------------------------------------------- helpers
def esc(s): return html.escape(str(s or ''), quote=True)

def requirements(b, fs):
    """what passes the badge, as (items, footnote, rule) - and nothing else"""
    t = b['type']
    if t == 'knowledge':
        items = ['Pass the %s quiz · %d %% or better · no sign-off needed' % (b['name'], fs['PASS'])]
        return items, 'Covers: ' + ' · '.join(l['t'] for l in b.get('lessons', [])), ''
    if t == 'bench':
        steps = [(s if isinstance(s, str) else s.get('t', '')).strip().rstrip('.') for s in (b.get('steps') or [])]
        steps = [x for x in steps if not x.startswith('DM a photo') and not x.startswith('Take a photo') and not x.startswith('Submit a photo')]
        steps.append('Photo of your work on the website · a mentor passes it')
        return steps, '', b.get('note', '')
    if t == 'witnessed' and b.get('reqs'):
        return [r['t'] + ((' · ' + r['d']) if r.get('d') else '') for r in b['reqs']], '', b.get('rule', '')
    return [b.get('standard', '')], '', b.get('rule', '')

def card_html(b, i, fs, bonus=False, cert=False):
    items, foot, rule = requirements(b, fs)
    lis = ''.join('<li>%s</li>' % esc(x) for x in items)
    track = fs['TRACK'][b['track']]
    ty = TYPE_NAME[b['type']]
    if cert and b['type'] == 'bench': ty = 'Photo'
    lab = ('Bonus badge · %s' % track) if bonus else track
    if b.get('minTier'): lab += ' · Tier %d pilots' % b['minTier']
    ds = ('<div class="ds">%s</div>' % esc(b['do'])) if cert else ''
    return ('<div class="card" data-i="%d" style="--t:%s"><span class="pin"><span>%s</span></span>'
            '<div class="lab"><span>%s</span><span class="ty ty-%s">%s</span></div>'
            '<div class="nm">%s</div>%s<ol>%s</ol>%s%s</div>'
            % (i, TRACK_COLOR[b['track']], '★' if bonus else str(i), esc(lab), b['type'], ty, esc(b['name']), ds, lis,
               ('<div class="ft">%s</div>' % esc(foot)) if foot else '',
               ('<div class="rl">%s</div>' % esc(rule)) if rule else ''))

def gate_html(n, cp, nxt, at):
    items = [r['t'] + ((' · ' + r['d']) if r.get('d') else '') for r in cp.get('reqs', [])] or [cp.get('standard', '')]
    lis = ''.join('<li>%s</li>' % esc(x) for x in items)
    rule = ('<div class="rl">%s</div>' % esc(cp['rule'])) if cp.get('rule') else ''
    return ('<div class="gatebox gate-%s" id="gatebox" style="--g:%s">'
            '<div class="lab">Gate %d &middot; the checkpoint into Tier %d &middot; %s</div>'
            '<div class="nm">%s</div><div class="ds">%s</div>'
            '<div class="req"><b>To pass</b><ol>%s</ol>%s</div>'
            '<div class="next">Through the gate you fly the %s &middot; sheet %d &rarr;</div></div>'
            % (at, nxt['color'], n, nxt['n'], TYPE_NAME[cp['type']],
               esc(cp['name']), esc(cp['do']), lis, rule, esc(nxt['short']), n + 1))

CERT_STEPS = [
  ('Ask Mr. Burr', 'his Google Form, at least 24 hours before you want to fly · one flight, one request · a club meeting is one request for the whole group, filed by a mentor'),
  ('A spotter', 'every flight has one with eyes on the aircraft · your own drone: anyone you name on the form · a club drone: a mentor is there'),
  ('Wait for the yes', 'he answers by email · fly once he approves, and only what you asked for · no answer means no'),
]

def cert_gate_html():
    lis = ''.join('<li><b>%s</b> · %s</li>' % (esc(t), esc(d)) for t, d in CERT_STEPS)
    return ('<div class="gatebox gate-down cert" id="gatebox" style="--g:var(--rust)">'
            '<div class="lab">The gate &middot; permission &middot; every flight</div>'
            '<div class="nm">Cleared to fly</div><div class="ds">All four badges on file is the Brophy Drone Certification. Then, for each flight:</div>'
            '<div class="req"><b>Every time</b><ol>%s</ol></div>'
            '<div class="next">Club or personal, FPV or not, DJI or whoop: everyone &middot; elmagoct.github.io/brophy-fpv-club/clearance/</div></div>' % lis)

FLAG = ('<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 38V4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
        '<path d="M8 5h28l-5 9 5 9H8Z" fill="#fff" stroke="currentColor" stroke-width="2"/>'
        '<path d="M8 5h7v6H8zM22 5h7v6h-7zM15 11h7v6h-7zM29 11h7v6h-7zM8 17h7v6H8zM22 17h7v6h-7z" fill="currentColor" opacity=".9"/></svg>')
FINISH = ('<div class="gatebox gate-up finish" id="gatebox" style="--g:var(--amber)">'
          '<div class="lab">Finish &middot; the end of the trail</div><div class="nm">Teach others</div>'
          '<div class="ds">Coach a new pilot through two badges, get officer approval, and you may sign off the badges you hold. The club trains its own replacements - that is how the path keeps going.</div></div>')

GATE_GLYPH = ('<svg viewBox="0 0 40 40" class="gg" aria-hidden="true"><rect x="5" y="4" width="30" height="30" rx="8" fill="none" stroke="%s" stroke-width="4"/>'
              '<path d="M2 38h10M28 38h10" stroke="%s" stroke-width="3.5" stroke-linecap="round"/></svg>')

def flow_html(cur):
    parts = []
    for i, t in enumerate(TIERS):
        here = t['id'] == cur
        parts.append('<div class="node%s" style="--c:%s"><span class="tn">Tier %d</span><span class="nn">%s</span>%s</div>'
                     % (' here' if here else '', t['color'], t['n'], esc(t['short']), '<span class="you">You are here</span>' if here else ''))
        if i < 3:
            nxt = TIERS[i + 1]
            parts.append('<div class="gate">%s<span>Gate %d</span></div>' % (GATE_GLYPH % (nxt['color'], nxt['color']), i + 1))
    return '<div class="flow"><div class="fl">The whole<br>path</div>%s</div>' % ''.join(parts)

def cert_flow_html():
    return ('<div class="flow"><div class="fl">Flight<br>clearance</div>'
            '<div class="node here" style="--c:var(--rust)"><span class="tn">Once</span><span class="nn">Brophy Drone Certification &middot; four badges</span><span class="you">You are here</span></div>'
            '<div class="gate">%s<span>The gate</span></div>'
            '<div class="node" style="--c:var(--rust)"><span class="tn">Every flight</span><span class="nn">Mr. Burr&rsquo;s yes, 24 h ahead</span></div></div>'
            % (GATE_GLYPH % ('var(--rust)', 'var(--rust)')))

# ----------------------------------------------------------------- render
EXIT = {}        # file -> y where its trail leaves the right edge (the next sheet's entry height)
HEX = {'var(--sky)': '#1c5578', 'var(--violet)': '#4b3287', 'var(--rust)': '#8f3d12', 'var(--green)': '#1f5230'}

def render(s, fs):
    cert = s.get('cert', False)
    d = s['dir']
    src = s.get('badges_from', s['tier'])
    badges = [b for b in fs['BADGES'] if b['tier'] == src and not b.get('checkpoint')]
    bonus = src == 'el'
    cards = ''.join(card_html(b, i, fs, bonus, cert) for i, b in enumerate(badges, 1))
    if bonus:
        cards += ('<div class="card p107" data-i="%d"><div class="lab"><span>Beyond the club</span></div><div class="nm">Part 107</div>'
                  '<ol><li>The FAA commercial licence &middot; the club runs a study group</li><li>You pay the exam, we supply the prep</li></ol></div>' % (len(badges) + 1))
    at = 'down' if d == 'down' else 'up'
    if cert:
        gate = cert_gate_html()
    elif s.get('finish'):
        gate = FINISH
    else:
        tier = next(t for t in TIERS if t['id'] == s['tier'])
        cp = next(b for b in fs['BADGES'] if b.get('checkpoint') and b['name'] == GATES[s['gate'] - 1])
        gate = gate_html(s['gate'], cp, TIERS[tier['n'] + 1], at)
    if s.get('start'):
        lead = '<div class="start"><span class="go">GO</span><div><b>%s</b>%s</div></div>' % (esc(s['start'][0]), esc(s['start'][1]))
        if s.get('sticker'): lead += '<div class="sticker">%s</div>' % esc(s['sticker'])
    else:
        lead = ('<div class="start came start-%s"><span class="go">%s</span><div><b>%s</b>%s</div></div>'
                % ('bottom' if d == 'up' else 'top', GATE_GLYPH % ('currentColor', 'currentColor'), esc(s['came'][0]), esc(s['came'][1])))
    heading = ''
    # the picture in the landscape: the gate with the next drone through it (or the 5-inch over the summit on sheet 4)
    pic = 'img/gate-c.svg' if s.get('finish') else 'img/gate-%d.svg' % s['gate']     # finish: a size probe only, not drawn
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', open(os.path.join(HERE, pic)).read()).group(1).split()]
    pw, ph = round(vb[2] * PX_PER_MM), round(vb[3] * PX_PER_MM)
    px_right = 36
    ptop = GY - ph - 44 if d == 'down' else 48      # the gate's feet clear of the page edge
    pcx = 1056 - px_right - pw / 2
    pcy = ptop + ph / 2
    peak = (pcx, ptop + ph - 8) if d == 'up' and not s.get('finish') else ((760, 300) if s.get('finish') else None)
    c = CENTERS[os.path.basename(pic)[:-4]]
    picture = '' if s.get('finish') else ('<img class="pic" src="%s" alt="" data-cx="%d" data-cy="%d" data-r="%d" style="right:%dpx;top:%dpx;width:%dpx;height:%dpx">'
               % (pic, round(c[0] * PX_PER_MM), round(c[1] * PX_PER_MM), round(c[2] * PX_PER_MM), px_right, ptop, pw, ph))
    for ex in s.get('extras', []):
        fname, crab = (ex, .6) if isinstance(ex, str) else ex      # crab: how far the drone turns toward the trail (1 = straight along it)
        vb2 = [float(v) for v in re.search(r'viewBox="([^"]+)"', open(os.path.join(HERE, 'img', fname + '.svg')).read()).group(1).split()]
        c = CENTERS[fname]
        picture += ('<img class="extra" src="img/%s.svg" alt="" data-cx="%d" data-cy="%d" data-r="%d" data-crab="%s" style="width:%dpx;height:%dpx">'
                    % (fname, round(c[0] * PX_PER_MM), round(c[1] * PX_PER_MM), round(c[2] * PX_PER_MM), crab, round(vb2[2] * PX_PER_MM), round(vb2[3] * PX_PER_MM)))
    # the flight line of the gate drone on screen (unit vector), so the exit trail follows it
    fdx, fdy = 0.78, 0.62
    if not s.get('finish'):
        yaw = math.radians(next(g[3] for g in GATE_SCENES if g[0] == 'gate-%d' % s['gate']))
        vx, vy = -math.sin(yaw), math.cos(yaw) * CAM_K
        n = math.hypot(vx, vy); fdx, fdy = vx / n, vy / n
    exit_y = min(GY - 50, max(60, pcy + fdy * 0.42 * max(pw, ph) + 20 * (1 if fdy > 0 else -1)))
    EXIT[s['file']] = exit_y
    prev = {'04-map-tier1': '03-map-tier0', '05-map-tier2': '04-map-tier1', '06-map-tier3': '05-map-tier2'}.get(s['file'])
    entry_y = EXIT.get(prev, 0) if prev else 0
    scene = scenery(s['scene'][0], s['scene'][1], gx=s['sheet'] * 1056, peak=peak, seed=s['sheet'])
    tier = next(t for t in TIERS if t['id'] == s['tier'])
    color = tier['color']
    title = 'Pilot Path — sheet %d of 4 — Tier %d %s' % (s['sheet'], tier['n'], tier['short'])
    page = TEMPLATE
    for k, v in {
        '@@TITLE@@': title, '@@TIERCOLOR@@': color, '@@SEED@@': str(s['sheet']) if not cert else '7', '@@DIR@@': d,
        '@@CLASSES@@': (' bonus' if bonus else '') + (' cert' if cert else '') + (' finish' if s.get('finish') else ''),
        '@@SCENE@@': scene, '@@TIERHEX@@': HEX.get(color, '#1f3350') if not bonus else '#7d5810', '@@PICTURE@@': picture, '@@ENTRY@@': str(round(entry_y)), '@@EXIT@@': str(round(exit_y)),
        '@@FDX@@': '%.3f' % fdx, '@@FDY@@': '%.3f' % fdy,
        '@@LEAD@@': lead, '@@HEADING@@': heading, '@@CARDS@@': cards, '@@GATE@@': gate,
    }.items(): page = page.replace(k, v)
    return page

TEMPLATE = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>@@TITLE@@</title>
<link rel="stylesheet" href="poster.css">
<link rel="stylesheet" href="map.css">
</head>
<body>
<div class="scene">@@SCENE@@</div>
<div class="sheet@@CLASSES@@" style="--tier:@@TIERCOLOR@@;--tiercol:@@TIERHEX@@;--entry:@@ENTRY@@px;--exit:@@EXIT@@px" data-dir="@@DIR@@" data-seed="@@SEED@@" data-fdx="@@FDX@@" data-fdy="@@FDY@@">
  <div class="map" id="map">
    <svg class="trail" id="trail"></svg>
    @@PICTURE@@
    @@LEAD@@@@HEADING@@
    <div class="cards" id="cards">@@CARDS@@</div>
    @@GATE@@
  </div>
</div>
<script>
/* Organic layout with real card heights. Cards alternate left / right in badge
   order, each a little narrower or wider, drifted and tilted by a fixed
   pseudo-random amount (seeded per sheet, so every rebuild looks the same).
   'down' sheets read from the top; 'up' sheets are laid out the same way and
   then mirrored, so badge 1 is at the bottom and the trail climbs to the gate.
   The trail enters the gate box, comes out of its right side, passes through
   the gate picture and runs off the sheet edge at --exit; the next sheet's
   entry marker sits at that same height (--entry). If the cards do not fit,
   the text is scaled down a step and laid out again. <body data-trail> says
   "ok", or "overflow Npx" if even the smallest step did not fit. */
(function () {
  var sheet = document.querySelector('.sheet'), map = document.getElementById('map');
  var DIR = sheet.getAttribute('data-dir'), SEED = +sheet.getAttribute('data-seed');
  var W = map.clientWidth, H = map.clientHeight, MID = W / 2, GAPMIN = 14, GAPMAX = sheet.classList.contains('bonus') ? 150 : 110;
  var EXIT = parseFloat(sheet.style.getPropertyValue('--exit')), FINISH = sheet.classList.contains('finish');
  var TIER = getComputedStyle(document.querySelector('.trail-probe') || sheet).getPropertyValue('--tiercol').trim() || '#1f3350';
  function rnd(i, k) { var x = Math.sin((i + 1) * 12.9898 + SEED * 78.233 + k * 37.719) * 43758.5453; return x - Math.floor(x); }
  function box(el) { var r = el.getBoundingClientRect(), m = map.getBoundingClientRect(); return {x: r.left - m.left, y: r.top - m.top, w: r.width, h: r.height}; }
  var lead = document.querySelector('.start'), sticker = document.querySelector('.sticker'), gate = document.getElementById('gatebox'), pic = document.querySelector('.pic');
  var cardBoxes = [];
  var FDX = parseFloat(sheet.getAttribute('data-fdx')), FDY = parseFloat(sheet.getAttribute('data-fdy'));
  var top, bottom, topR;
  if (DIR === 'down') {
    var lb = box(lead); top = lb.y + lb.h + 18; topR = 60;
    if (sticker) { var sb = box(sticker); topR = sb.y + sb.h + 16; }
    bottom = box(gate).y - 26;
  } else {
    var gb = box(gate); top = gb.y + gb.h + 28; topR = top;
    var lb2 = box(lead); bottom = lb2.y - 16;
  }
  // keep the right-hand column clear of the picture when it sits beside the cards

  function layout(k) {
    sheet.style.setProperty('--k', k);
    var cards = Array.prototype.slice.call(document.querySelectorAll('#cards .card')), STEP = 56;
    cards.forEach(function (c, i) {
      var L = !(i % 2), w = Math.round(410 + 40 * rnd(i, 1)), drift = Math.round(20 * rnd(i, 2));
      c.style.width = w + 'px';
      c.style.left = (L ? 44 + drift : W - 44 - w - drift) + 'px';
      c.style.setProperty('--tilt', ((rnd(i, 3) - .5) * 2.6).toFixed(2) + 'deg');
      c.classList.toggle('side-R', !L); c.classList.toggle('side-L', L);
    });
    var off = cards.length ? Math.min(Math.round(cards[0].offsetHeight * 0.5), 100) : 0;
    function place(gap) {
      var yL = top, yR = Math.max(topR, top + off), prev = -1e9, low = 0;
      cards.forEach(function (c, i) {
        var y = Math.max(i % 2 ? yR : yL, prev + STEP) + Math.round(10 * rnd(i, 4));
        c.style.top = y + 'px'; prev = y;
        if (i % 2) yR = y + c.offsetHeight + gap; else yL = y + c.offsetHeight + gap;
        low = Math.max(low, y + c.offsetHeight);
      });
      return low - bottom;
    }
    var over = 0;
    for (var gap = GAPMAX; gap >= GAPMIN; gap -= 2) { over = place(gap); if (over <= 0) break; }
    if (DIR === 'up') cards.forEach(function (c) { c.style.top = (top + bottom - (c.offsetTop + c.offsetHeight)) + 'px'; });
    cardBoxes = cards.map(box).concat([box(gate), box(lead)]);
    return Math.max(0, over);
  }

  function catmull(p) {
    var d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1), q = [p[0]].concat(p, [p[p.length - 1]]);
    for (var i = 1; i < q.length - 2; i++) {
      var a = q[i - 1], b = q[i], c = q[i + 1], e = q[i + 2], t = 1 / 6;
      d += ' C' + (b[0] + (c[0] - a[0]) * t).toFixed(1) + ' ' + (b[1] + (c[1] - a[1]) * t).toFixed(1) + ',' +
           (c[0] - (e[0] - b[0]) * t).toFixed(1) + ' ' + (c[1] - (e[1] - b[1]) * t).toFixed(1) + ',' + c[0].toFixed(1) + ' ' + c[1].toFixed(1);
    }
    return d;
  }

  function trail() {
    function ctr(el) { var b = box(el); return [b.x + b.w / 2, b.y + b.h / 2]; }
    var pins = Array.prototype.slice.call(document.querySelectorAll('#cards .card:not(.p107) .pin')).map(ctr);
    var g = ctr(lead.querySelector('.go')), pts = [];
    if (lead.classList.contains('came')) pts.push([-60, g[1]], [40, g[1]]);  // in level from the edge of the previous sheet
    var s = DIR === 'down' ? 1 : -1;
    pts.push(g, [g[0] + 26, g[1] + s * 62]);
    var gi = -1, gbest = 0;
    for (var j = 1; j < pins.length; j++) { var gp = Math.abs(pins[j][1] - pins[j - 1][1]); if (gp > gbest) { gbest = gp; gi = j; } }
    pins.forEach(function (p, i) {
      var a = pts[pts.length - 1], my = (a[1] + p[1]) / 2, side = p[0] < MID ? 1 : -1;
      if (i === gi && gbest > 230) {
        var r = 34, cy = my;
        pts.push([MID + side * 40, cy - s * 70]);
        for (var t = 0; t <= 8; t++) { var ang = (-Math.PI / 2) * s + side * s * t * (2 * Math.PI / 8); pts.push([MID + Math.cos(ang) * r, cy + Math.sin(ang) * r]); }
        pts.push([MID - side * 36, cy + s * 70]);
      } else pts.push([MID + (rnd(i, 5) - .5) * 56, my]);
      pts.push(p);
    });
    var gb = box(gate), gmid = gb.x + gb.w / 2;
    var gateIn = DIR === 'down' ? [gmid, gb.y + 8] : [gmid, gb.y + gb.h - 8];
    if (DIR === 'down') pts.push([gmid - 30, gb.y - 50], gateIn);
    else pts.push([gmid - 30, gb.y + gb.h + 50], gateIn);
    var svg = document.getElementById('trail'), d = catmull(pts);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    var paths = '<path class="trail-shadow" d="' + d + '"/><path class="trail-line" d="' + d + '"/>';
    var holes = [];                                            // [x, y, r] where a drone sits on the trail
    // the extra drones ride the trail in the biggest gaps between stops
    var probe = document.createElementNS('http://www.w3.org/2000/svg', 'path'); probe.setAttribute('d', d); svg.appendChild(probe);
    var len = probe.getTotalLength();
    var anchors = pins.concat([gateIn]), gaps = [];          // the stretch from the start marker to badge 1 hugs the first card: never there
    for (var i = 1; i < anchors.length; i++) {
      var a0 = anchors[i - 1], a1 = anchors[i];
      gaps.push({ len: Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), mid: [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2] });
    }
    gaps.sort(function (p, q) { return q.len - p.len; });
    function clear(x, y, r) {                                  // the drone's circle touches no card or box
      for (var i = 0; i < cardBoxes.length; i++) { var b = cardBoxes[i]; var nx = Math.max(b.x, Math.min(x, b.x + b.w)), ny = Math.max(b.y, Math.min(y, b.y + b.h)); if (Math.hypot(x - nx, y - ny) < r) return false; }
      return x > r * .6 && x < W - r * .6;
    }
    var extras = Array.prototype.slice.call(document.querySelectorAll('.extra'));
    extras.forEach(function (img, k) {
      var gp = gaps[k], r = +img.getAttribute('data-r'); if (!gp || gp.len < Math.max(3.4 * r, 290)) { img.style.display = 'none'; return; }
      var best = 0, bd = 1e9;
      for (var t = 0; t <= len; t += 5) { var q = probe.getPointAtLength(t), dd = (q.x - gp.mid[0]) * (q.x - gp.mid[0]) + (q.y - gp.mid[1]) * (q.y - gp.mid[1]); if (dd < bd) { bd = dd; best = t; } }
      var found = -1;                                          // slide along the trail until the drone is clear of every card
      for (var off = 0; off <= 400 && found < 0; off += 20) { [best + off, best - off].forEach(function (tt) { if (found >= 0 || tt < 0 || tt > len) return; var q = probe.getPointAtLength(tt); if (clear(q.x, q.y, Math.max(r * 1.15, 80))) found = tt; }); }
      if (found < 0) { img.style.display = 'none'; return; }
      best = found;
      var p0 = probe.getPointAtLength(Math.max(0, best - 12)), p1 = probe.getPointAtLength(Math.min(len, best + 12)), pm = probe.getPointAtLength(best);
      var ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI * (+img.getAttribute('data-crab') || .6);   // crab: part-way between nose-right and the trail's direction
      var cx = +img.getAttribute('data-cx'), cy = +img.getAttribute('data-cy');
      img.style.display = 'block'; img.style.left = (pm.x - cx) + 'px'; img.style.top = (pm.y - cy) + 'px';
      img.style.transformOrigin = cx + 'px ' + cy + 'px'; img.style.transform = 'rotate(' + ang.toFixed(1) + 'deg)';
      holes.push([pm.x, pm.y, r * 1.15]);
    });
    if (!FINISH && pic) {                                     // out of the box, through the gate along the flight line, off the edge
      var pb2 = box(pic), sz = Math.max(pb2.w, pb2.h);
      var pcx = pb2.x + (+pic.getAttribute('data-cx')), pcy = pb2.y + (+pic.getAttribute('data-cy'));
      var ey = Math.max(gb.y + 30, Math.min(gb.y + gb.h - 30, pcy - FDY * .45 * sz));
      var ex = [[gb.x + gb.w - 10, ey], [pcx - FDX * .48 * sz, pcy - FDY * .48 * sz], [pcx, pcy], [pcx + FDX * .42 * sz, pcy + FDY * .42 * sz], [W - 40, EXIT], [W + 60, EXIT]];   // level out before the edge: the next sheet comes in level
      var d2 = catmull(ex);
      paths += '<path class="trail-shadow" d="' + d2 + '"/><path class="trail-line" d="' + d2 + '"/>';
      holes.push([pcx, pcy, (+pic.getAttribute('data-r')) * 1.25]);
    }
    // the dots fade out under every drone and back in after it
    var mask = '<defs><radialGradient id="hole"><stop offset="0" stop-color="#000"/><stop offset=".5" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
               '<mask id="tm" maskUnits="userSpaceOnUse" x="-100" y="-100" width="' + (W + 200) + '" height="' + (H + 200) + '"><rect x="-100" y="-100" width="' + (W + 200) + '" height="' + (H + 200) + '" fill="#fff"/>' +
               holes.map(function (h) { return '<circle cx="' + h[0].toFixed(1) + '" cy="' + h[1].toFixed(1) + '" r="' + h[2].toFixed(1) + '" fill="url(#hole)"/>'; }).join('') + '</mask></defs>';
    svg.innerHTML = mask + '<g mask="url(#tm)">' + paths + '</g>';
  }

  function run() {
    var ks = [1, .96, .92, .88, .84, .80, .76], over = 0;
    for (var i = 0; i < ks.length; i++) { over = layout(ks[i]); if (over <= 0) break; }
    trail();
    document.body.setAttribute('data-trail', over > 0 ? 'overflow ' + Math.round(over) + 'px' : 'ok k=' + sheet.style.getPropertyValue('--k'));
  }
  run();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
})();
</script>
</body></html>
'''

if __name__ == '__main__':
    fs = load_fs()
    print('badges.js: %d badges' % len(fs['BADGES']))
    for s in SHEETS:
        with open(os.path.join(HERE, s['file'] + '.html'), 'w', encoding='utf-8') as f:
            f.write(render(s, fs))
        print('wrote', s['file'] + '.html')
