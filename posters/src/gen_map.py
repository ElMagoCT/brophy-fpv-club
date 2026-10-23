#!/usr/bin/env python3
"""Generates the four Pilot Path map sheets (03..06), one tier per sheet.

    python3 gen_map.py          # writes 03-map-tier0.html .. 06-map-tier3.html
    python3 build.py 03-map-tier0 04-map-tier1 05-map-tier2 06-map-tier3

Every word on a badge card comes from ../../flightschool/badges.js (read with
node), so the posters can never drift from the website. Change a badge there,
rerun this, rebuild.

Layout (2026-10-23 rewrite, after Micah's "it is not clear what the flow is"):
  - every sheet reads the same way, TOP TO BOTTOM. Badge cards alternate left /
    right down a dotted trail with numbered pins and direction chevrons.
  - a tier's checkpoint is drawn as a race GATE at the foot of the sheet, with
    the drone it unlocks flying through it (img/gate-N.svg, from drones.py).
    The gate card lists only the checkpoint's own requirements - no
    prerequisite tick list; the badges above it ARE the way to the gate.
  - the header shows what you fly in this tier (img/drone-*.svg): the drones
    get bigger sheet by sheet - radio, Meteor whoop, Pavo, then the 5-inch and
    the Cinebot.
  - a "the whole path" strip under the header repeats the four tiers and the
    three gates on every sheet, with YOU ARE HERE on the current tier.
  - cards list only what passes the badge: the quiz, the bench steps, or the
    witnessed requirements. Sheet 4's cards are labelled BONUS BADGE.

The sheet's own script spaces the cards with their real heights, scales the
text down a step if a sheet is crowded, draws the trail through the pins and
sets <body data-trail> to "ok k=..." or "overflow Npx" (build.py waits for it).
"""
import html, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BADGES_JS = os.path.normpath(os.path.join(HERE, '..', '..', 'flightschool', 'badges.js'))

# ----------------------------------------------------------------- the data
def load_fs():
    node = os.path.expanduser('~/.local/node-v24.19.0-darwin-arm64/bin/node')
    if not os.path.exists(node):
        node = shutil.which('node') or sys.exit('node is needed to read badges.js')
    js = ("global.window={};eval(require('fs').readFileSync(%s,'utf8'));"
          "var F=window.FS;process.stdout.write(JSON.stringify({TIERS:F.TIERS,TRACK:F.TRACK,"
          "BADGES:F.BADGES,LESSON_TITLES:F.LESSON_TITLES,PASS:F.PASS,SIM_HOURS:F.SIM_HOURS}))") % json.dumps(BADGES_JS)
    return json.loads(subprocess.run([node, '-e', js], capture_output=True, text=True, check=True).stdout)

TRACK_COLOR = {'flight': 'var(--sky)', 'build': 'var(--amber)', 'know': 'var(--green)', 'crew': 'var(--violet)'}
TYPE_NAME = {'knowledge': 'Quiz', 'bench': 'Bench', 'witnessed': 'Witnessed', 'auto': 'Automatic'}

# the four tiers as they appear in the flow strip, and the drone each one flies
TIERS = [
  dict(id='t0', n=0, short='Simulator', fly='The five FPV sims', drones=[('radio', 118)], color='var(--sky)'),
  dict(id='t1', n=1, short='Meteor 75 Pro', fly='Meteor 75 Pro · sub-250 g whoop · indoors', drones=[('whoop', 132)], color='var(--violet)'),
  dict(id='t2', n=2, short='Pavo 20 Pro', fly='Pavo 20 Pro · 2-inch cinewhoop · the first full-size airframe', drones=[('pavo', 152)], color='var(--rust)'),
  dict(id='t3', n=3, short='Event Pilot', fly='Any Tier 2 airframe at a school event · 5-inch, Cinebot · always with a spotter', drones=[('cinebot', 124), ('five', 168)], color='var(--green)'),
]
GATES = ['Meteor 75 Pro Certification', 'Pavo 20 Pro Flight', 'Event Pilot']   # the checkpoints, by name, gate 1..3

# Poster-only text (the website has its own shorter versions).
SHEETS = [
  dict(file='03-map-tier0', sheet=1, tier='t0', name='SIMULATOR', dir_label='Start here',
       start=('START', 'Add your name at the sim kiosk · then fly'),
       sticker='Bonus challenge: do all five in one community period and you fly that day',   # 2026-10-15, Micah
       gate=1),
  dict(file='04-map-tier1', sheet=2, tier='t1', name='METEOR 75 PRO<br>CERTIFICATION', long=True,
       came=('Gate 1 passed', 'Meteor 75 Pro Certification · you fly the club Meteor'),
       gate=2),
  dict(file='05-map-tier2', sheet=3, tier='t2', name='FULL-SIZE',
       came=('Gate 2 passed', 'Pavo 20 Pro Flight · you fly the Pavo'),
       gate=3),
  dict(file='06-map-tier3', sheet=4, tier='t3', badges_from='el', name='EVENT PILOT', long=True,
       came=('Gate 3 passed', 'Event Pilot · you fly for the school'),
       gate=None),
]

# ----------------------------------------------------------------- helpers
def esc(s): return html.escape(str(s or ''), quote=True)

def short_step(s):
    """'Motors on — right screw length…' -> 'Motors on'. Bench steps are full
    sentences on the website; the poster lists them as a compact sequence."""
    cut = len(s)
    for sep in (' — ', ': ', ', ', ' (', ' - '):
        k = s.find(sep)
        if 0 < k < cut: cut = k
    return s[:cut].strip().rstrip('.')

def requirements(b, fs):
    """what passes the badge, as (items, footnote) - and nothing else"""
    t = b['type']
    if t == 'knowledge':
        items = ['Pass the %s quiz · %d %% or better · no sign-off needed' % (b['name'], fs['PASS'])]
        foot = 'Covers: ' + ' · '.join(l['t'] for l in b.get('lessons', []))
        return items, foot, ''
    if t == 'bench':
        steps = [(s if isinstance(s, str) else s.get('t', '')).strip().rstrip('.') for s in (b.get('steps') or [])]
        steps = [x for x in steps if not x.startswith('DM a photo') and not x.startswith('Take a photo') and not x.startswith('Submit a photo')]
        steps.append('Photo of your work on the website · a mentor passes it')
        return steps, '', b.get('note', '')
    if t == 'witnessed' and b.get('reqs'):
        items = [r['t'] + ((' · ' + r['d']) if r.get('d') else '') for r in b['reqs']]
        return items, '', b.get('rule', '')
    if t == 'witnessed':
        return [b.get('standard', '')], '', b.get('rule', '')
    return [b.get('standard', '')], '', ''

def card_html(b, i, fs, bonus=False):
    items, foot, rule = requirements(b, fs)
    lis = ''.join('<li>%s</li>' % esc(x) for x in items)
    track = fs['TRACK'][b['track']]
    lab = 'Bonus badge · %s' % track if bonus else track
    if b.get('minTier'): lab += ' · Tier %d pilots' % b['minTier']
    return ('<div class="card" data-i="%d" style="--t:%s"><span class="pin"><span>%s</span></span>'
            '<div class="lab"><span>%s</span><span class="ty ty-%s">%s</span></div>'
            '<div class="nm">%s</div><ol>%s</ol>%s%s</div>'
            % (i, TRACK_COLOR[b['track']], '★' if bonus else str(i), esc(lab), b['type'], TYPE_NAME[b['type']], esc(b['name']), lis,
               ('<div class="ft">%s</div>' % esc(foot)) if foot else '',
               ('<div class="rl">%s</div>' % esc(rule)) if rule else ''))

def gate_html(n, cp, nxt):
    """the gate at the foot of a sheet: the checkpoint's own requirements, no prerequisites"""
    items = [r['t'] + ((' · ' + r['d']) if r.get('d') else '') for r in cp.get('reqs', [])] or [cp.get('standard', '')]
    lis = ''.join('<li>%s</li>' % esc(x) for x in items)
    rule = ('<div class="rl">%s</div>' % esc(cp['rule'])) if cp.get('rule') else ''
    return ('<div class="gatebox" id="gatebox" style="--g:%s">'
            '<div class="gl"><img src="img/gate-%d.svg" alt=""><div class="cap">Gate %d &middot; through it, you fly the %s</div></div>'
            '<div class="gr"><div class="lab">Gate %d &middot; the Tier %d checkpoint &middot; %s</div>'
            '<div class="nm">%s</div><div class="ds">%s</div>'
            '<div class="req"><b>To pass</b><ol>%s</ol>%s</div>'
            '<div class="next">&rarr; Sheet %d &middot; Tier %d &middot; %s</div></div></div>'
            % (nxt['color'], n, n, esc(nxt['short']), n, nxt['n'], TYPE_NAME[cp['type']],
               esc(cp['name']), esc(cp['do']), lis, rule, n + 1, nxt['n'], esc(nxt['short'])))

GATE_GLYPH = ('<svg viewBox="0 0 40 40" class="gg" aria-hidden="true"><rect x="5" y="4" width="30" height="30" rx="8" fill="none" stroke="%s" stroke-width="4"/>'
              '<path d="M2 38h10M28 38h10" stroke="%s" stroke-width="3.5" stroke-linecap="round"/></svg>')

def flow_html(cur):
    """the whole path, four tiers and three gates, with YOU ARE HERE"""
    parts = []
    for i, t in enumerate(TIERS):
        here = t['id'] == cur
        parts.append('<div class="node%s" style="--c:%s"><span class="tn">Tier %d</span><span class="nn">%s</span>%s</div>'
                     % (' here' if here else '', t['color'], t['n'], esc(t['short']), '<span class="you">You are here</span>' if here else ''))
        if i < 3:
            nxt = TIERS[i + 1]
            parts.append('<div class="gate">%s<span>Gate %d</span></div>' % (GATE_GLYPH % (nxt['color'], nxt['color']), i + 1))
    return '<div class="flow"><div class="fl">The whole<br>path</div>%s</div>' % ''.join(parts)

# ----------------------------------------------------------------- render
def render(s, fs):
    tier = next(t for t in TIERS if t['id'] == s['tier'])
    src = s.get('badges_from', s['tier'])
    badges = [b for b in fs['BADGES'] if b['tier'] == src and not b.get('checkpoint')]
    bonus = src == 'el'
    cards = ''.join(card_html(b, i, fs, bonus) for i, b in enumerate(badges, 1))
    if bonus:
        cards += ('<div class="card p107" data-i="%d"><div class="lab"><span>Beyond the club</span></div><div class="nm">Part 107</div>'
                  '<ol><li>The FAA commercial licence &middot; the club runs a study group</li><li>You pay the exam, we supply the prep</li></ol></div>' % (len(badges) + 1))
    gate = ''
    if s.get('gate'):
        cp = next(b for b in fs['BADGES'] if b.get('checkpoint') and b['name'] == GATES[s['gate'] - 1])
        gate = gate_html(s['gate'], cp, TIERS[tier['n'] + 1])
    if s.get('start'):
        lead = ('<div class="start"><span class="go">GO</span><div><b>%s</b>%s</div></div>' % s['start'])
        if s.get('sticker'): lead += '<div class="sticker">%s</div>' % esc(s['sticker'])
    else:
        g = s['came']
        lead = ('<div class="start came" style="--c:%s"><span class="go">%s<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="4" width="30" height="30" rx="8" fill="none" stroke="currentColor" stroke-width="4"/>'
                '<path d="M2 38h10M28 38h10" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg></span><div><b>%s &#10003;</b>%s</div></div>'
                % (tier['color'], '', esc(g[0]), esc(g[1])))
    heading = ''
    if bonus:
        heading = ('<div class="summit"><div class="sl">The top of the path</div><div class="st">You fly for the school</div>'
                   '<div class="sd">Pep-rally race &middot; Best of Brophy footage &middot; any Tier 2 airframe &middot; a spotter beside you &middot; Flight Clearance and Mr. Burr&rsquo;s yes for every flight</div></div>'
                   '<div class="bonushead"><span>Bonus badges</span><span>after Event Pilot &middot; any order, any time &middot; not counted</span></div>'
                   '<div class="finish" id="finish"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 38V4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
                   '<path d="M8 5h28l-5 9 5 9H8Z" fill="#fff" stroke="currentColor" stroke-width="2"/>'
                   '<path d="M8 5h7v6H8zM22 5h7v6h-7zM15 11h7v6h-7zM29 11h7v6h-7zM8 17h7v6H8zM22 17h7v6h-7z" fill="currentColor" opacity=".9"/></svg>'
                   '<div><b>That is the whole path</b>Keep flying. Keep signing people off.</div></div>')
    drones = ''.join('<img src="img/drone-%s.svg" alt="" style="height:%dpx">' % d for d in tier['drones'])
    legend = ''.join('<span><i style="background:%s"></i>%s</span>' % (TRACK_COLOR[k], esc(v)) for k, v in fs['TRACK'].items())
    onsheet = ('%d bonus badges' % len(badges)) if bonus else ('%d badges, then Gate %d' % (len(badges), s['gate']))
    page = TEMPLATE
    for k, v in {
        '@@TITLE@@': 'Pilot Path — sheet %d of 4 — Tier %d %s' % (s['sheet'], tier['n'], s['name'].replace('<br>', ' ').title()),
        '@@TIERCOLOR@@': tier['color'], '@@SHEET@@': str(s['sheet']), '@@TIERN@@': str(tier['n']),
        '@@NAME@@': s['name'], '@@LONG@@': ' long' if s.get('long') else '', '@@BONUS@@': ' bonus' if bonus else '',
        '@@FLY@@': esc(tier['fly']), '@@ONSHEET@@': onsheet, '@@DRONES@@': drones, '@@FLOW@@': flow_html(s['tier']),
        '@@LEAD@@': lead, '@@HEADING@@': heading, '@@CARDS@@': cards, '@@GATE@@': gate, '@@LEGEND@@': legend,
        '@@PASS@@': str(fs['PASS']),
    }.items(): page = page.replace(k, v)
    return page

TEMPLATE = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>@@TITLE@@</title>
<link rel="stylesheet" href="poster.css">
<link rel="stylesheet" href="map.css">
</head>
<body>
<div class="bg"><div class="grid"></div><div class="fine"></div><div class="vig"></div></div>
<div class="sheet@@BONUS@@" style="--tier:@@TIERCOLOR@@" data-sheet="@@SHEET@@">
  <div class="stamp"><b>BROPHY</b>FPV CLUB<br>PILOT PATH</div>
  <div class="eyebrow"><h2>The pilot path &middot; sheet @@SHEET@@ of 4 &middot; read top to bottom</h2><span class="rule"></span></div>
  <div class="tierhead">
    <div class="tt"><div class="row"><div class="tn">TIER @@TIERN@@</div><div class="tname@@LONG@@">@@NAME@@</div></div>
      <div class="fly"><b>You fly</b> @@FLY@@</div>
      <div class="fly"><b>On this sheet</b> @@ONSHEET@@</div></div>
    <div class="drones">@@DRONES@@</div>
  </div>
  @@FLOW@@

  <div class="map" id="map">
    <svg class="trail" id="trail"></svg>
    @@LEAD@@@@HEADING@@
    <div class="cards" id="cards">@@CARDS@@</div>
    @@GATE@@
  </div>

  <div class="legend">@@LEGEND@@<span class="how"><b>Quiz</b> badges: pass at @@PASS@@ %, no sign-off &middot; <b>Bench</b> and <b>witnessed</b> badges: a mentor who holds the badge signs it off &middot; demonstration, not attendance</span></div>
  <div class="clearance"><b>To fly at Brophy you also need Flight Clearance</b> &middot; the Brophy Drone Certification and Mr. Burr&rsquo;s yes before every flight &middot; see the Flight Clearance sheet &middot; <span class="url">elmagoct.github.io/brophy-fpv-club/clearance/</span></div>
  <div class="qrmini qr"><svg viewBox="0 0 370 370"><use href="qr-path.svg#q"/></svg><div class="say"><b>Full badge list</b>scan</div></div>
  <div class="foot"><span><b>Brophy FPV Club</b> &middot; Pilot Path &middot; Tier @@TIERN@@ of 3</span><span>mtucker27@ for questions</span></div>
</div>
<script>
/* Top-to-bottom layout with real card heights. Cards alternate left / right in
   badge order; the right column starts half a card lower so the pins step
   down like stairs. If the columns do not fit above the gate, the card text is
   scaled down a step and laid out again. <body data-trail> says "ok", or
   "overflow Npx" if even the smallest step did not fit. */
(function () {
  var sheet = document.querySelector('.sheet'), map = document.getElementById('map');
  var W = map.clientWidth, H = map.clientHeight, PADX = 56, CW = 418, GAPMIN = 14, GAPMAX = sheet.classList.contains('bonus') ? 190 : 64;
  var XL = PADX, XR = W - PADX - CW;
  function box(el) { var r = el.getBoundingClientRect(), m = map.getBoundingClientRect(); return {x: r.left - m.left, y: r.top - m.top, w: r.width, h: r.height}; }
  var lead = document.querySelector('.start'), sticker = document.querySelector('.sticker'), summit = document.querySelector('.summit'), bh = document.querySelector('.bonushead'), gate = document.getElementById('gatebox');
  var topL = 0, topR = 0;
  if (lead) { var b = box(lead); topL = Math.max(topL, b.y + b.h + 16); topR = Math.max(topR, 24); }
  if (sticker) { var b2 = box(sticker); topR = Math.max(topR, b2.y + b2.h + 14); }
  if (summit) { var b3 = box(summit); topL = topR = b3.y + b3.h + 16; }
  if (bh) { bh.style.top = (topL + 2) + 'px'; var b4 = box(bh); topL = topR = b4.y + b4.h + 14; }
  var bottom = gate ? box(gate).y - 22 : H - 30;

  function layout(k) {
    sheet.style.setProperty('--k', k);
    var cards = Array.prototype.slice.call(document.querySelectorAll('#cards .card')), STEP = 56;
    cards.forEach(function (c, i) { c.style.width = CW + 'px'; c.style.left = (i % 2 ? XR : XL) + 'px'; c.classList.toggle('side-R', !!(i % 2)); c.classList.toggle('side-L', !(i % 2)); });
    var off = cards.length ? Math.min(Math.round(cards[0].offsetHeight * 0.55), 110) : 0;
    function place(gap) {                                   // alternate sides; every card starts lower than the one before
      var yL = topL, yR = Math.max(topR, topL + off), prev = -1e9, low = 0;
      cards.forEach(function (c, i) {
        var y = Math.max(i % 2 ? yR : yL, prev + STEP);
        c.style.top = y + 'px'; prev = y;
        if (i % 2) yR = y + c.offsetHeight + gap; else yL = y + c.offsetHeight + gap;
        low = Math.max(low, y + c.offsetHeight);
      });
      return low - bottom;                                  // > 0 means the lowest card runs into the gate
    }
    var over = 0;
    for (var gap = GAPMAX; gap >= GAPMIN; gap -= 2) { over = place(gap); if (over <= 0) break; }
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
    var pins = Array.prototype.slice.call(document.querySelectorAll('#cards .card .pin')).map(ctr);
    var pts = [], MID = W / 2;
    if (lead) { var g = ctr(lead.querySelector('.go')); pts.push(g, [g[0] + 70, g[1] + 34]); }
    else if (summit) { var sb = box(summit); pts.push([MID, sb.y + sb.h - 6], [MID - 30, sb.y + sb.h + 40]); }
    pins.forEach(function (p, i) {
      if (pts.length) { var a = pts[pts.length - 1]; pts.push([MID + (p[0] < MID ? 22 : -22), (a[1] + p[1]) / 2]); }
      pts.push(p);
    });
    if (gate) { var gb = box(gate); pts.push([MID - 10, gb.y - 40], [MID, gb.y + 6]); }
    else { var last = pts[pts.length - 1], fin = document.getElementById('finish'), low = 0;
           document.querySelectorAll('#cards .card').forEach(function (c) { low = Math.max(low, c.offsetTop + c.offsetHeight); });
           var fy = Math.max(last[1] + 130, low + 40);
           pts.push([MID - 20, (last[1] + fy) / 2], [MID, fy]);
           if (fin) { fin.style.left = (MID - fin.offsetWidth / 2) + 'px'; fin.style.top = (fy - 12) + 'px'; } }
    var svg = document.getElementById('trail'), d = catmull(pts);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    var inner = '<path class="trail-shadow" d="' + d + '"/><path class="trail-line" d="' + d + '"/>';
    // a direction chevron between every pair of pins, pointing along the trail
    var probe = document.createElementNS('http://www.w3.org/2000/svg', 'path'); probe.setAttribute('d', d); svg.appendChild(probe);
    var len = probe.getTotalLength(), marks = [];
    for (var i = 1; i < pins.length; i++) marks.push([(pins[i - 1][0] + pins[i][0]) / 2, (pins[i - 1][1] + pins[i][1]) / 2]);
    if (gate && pins.length) marks.push([MID - 4, (pins[pins.length - 1][1] + box(gate).y) / 2]);
    marks.forEach(function (m) {
      var best = 0, bd = 1e9;                              // nearest point on the path to the midpoint
      for (var s = 0; s <= len; s += 6) { var q = probe.getPointAtLength(s), dd = (q.x - m[0]) * (q.x - m[0]) + (q.y - m[1]) * (q.y - m[1]); if (dd < bd) { bd = dd; best = s; } }
      var p0 = probe.getPointAtLength(Math.max(0, best - 4)), p1 = probe.getPointAtLength(Math.min(len, best + 4));
      var ang = Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI, pm = probe.getPointAtLength(best);
      inner += '<g class="chev" transform="translate(' + pm.x.toFixed(1) + ' ' + pm.y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')"><circle r="15"/><path d="M-6 -8L8 0L-6 8Z"/></g>';
    });
    svg.innerHTML = inner;
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
