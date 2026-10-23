#!/usr/bin/env python3
"""Generates 02-cert.html, the Flight Clearance sheet: the four badges of the
Brophy Drone Certification (tier 'cl' in badges.js, read with node like the
map sheets) and the permission steps from the Flight Clearance page.

    python3 gen_cert.py && python3 build.py 02-cert
"""
import os
from gen_map import load_fs, requirements, esc, TYPE_NAME, TRACK_COLOR, HERE

PERMISSION = [
  ('Ask Mr. Burr', 'His Google Form, at least 24 hours before you want to fly. One flight, one request. A club meeting is one request for the whole group, filed by a mentor; a personal flight is your own.'),
  ('Spotter', 'Every flight has a spotter with eyes on the aircraft. Your own drone: anyone you name on the form. A club drone: a mentor is there for the session.'),
  ('Wait for the yes', 'He answers by email. Fly once Mr. Burr approves, and only what you asked for. No answer means no.'),
]

def card(b, fs, n):
    items, foot, rule = requirements(b, fs)
    lis = ''.join('<li>%s</li>' % esc(x) for x in items)
    return ('<div class="box bc" style="--t:%s"><div class="n">%d</div><div class="lab"><span>%s</span><span class="ty">%s</span></div>'
            '<div class="nm">%s</div><div class="ds">%s</div><ol>%s</ol>%s<div class="est">%s</div></div>'
            % (TRACK_COLOR[b['track']], n, esc(fs['TRACK'][b['track']]), {'bench': 'Photo'}.get(b['type'], TYPE_NAME[b['type']]), esc(b['name']), esc(b['do']), lis,
               ('<div class="ft">%s</div>' % esc(foot)) if foot else '', esc(b.get('est', ''))))

def render(fs):
    cl = [b for b in fs['BADGES'] if b['tier'] == 'cl']
    cards = ''.join(card(b, fs, i) for i, b in enumerate(cl, 1))
    steps = ''.join('<div class="box step"><div class="num">%d</div><div><div class="t">%s</div><div class="s">%s</div></div></div>' % (i, esc(t), esc(d)) for i, (t, d) in enumerate(PERMISSION, 1))
    return TEMPLATE.replace('@@CARDS@@', cards).replace('@@STEPS@@', steps).replace('@@N@@', str(len(cl)))

TEMPLATE = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Poster 2 — Flight Clearance</title>
<link rel="stylesheet" href="poster.css">
<style>
  :root{--paper:#ffffff;--paper-2:#f3f4f6;--glass:#f6f7f9}
  body{background-color:#fff}
  .box{border-color:rgba(31,51,80,.3)}
  .stamp{top:62px;right:60px;background-color:#fff}
  .hero{position:relative}
  h1{font-family:var(--sketch);font-weight:700;font-size:104px;line-height:.9;margin-top:26px;letter-spacing:.5px;white-space:nowrap}
  h1 .rust{color:var(--rust)}
  .lede{font-family:var(--hand);font-size:29px;color:var(--ink-soft);margin-top:18px;max-width:600px;line-height:1.25}
  .hero img{position:absolute;right:-6px;bottom:-16px;display:block;height:210px}

  .sec{display:flex;align-items:baseline;gap:14px;margin-top:30px}
  .sec h3{font-family:var(--mono);font-weight:400;font-size:15px;letter-spacing:.24em;text-transform:uppercase;color:var(--rust)}
  .sec .rule{flex:1;height:1.5px;background:var(--line-hard);opacity:.7}
  .sec .hint{font-family:var(--hand);font-size:18px;color:var(--ink-soft)}

  .badges{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
  .bc{position:relative;padding:16px 20px 14px 22px;border-left:8px solid var(--t);font-size:15px}
  .bc .n{position:absolute;right:16px;top:12px;width:44px;height:44px;border-radius:50%;border:4px solid var(--t);display:grid;place-items:center;font-family:var(--mono);font-size:21px;color:var(--ink)}
  .bc .lab{display:flex;gap:10px;align-items:baseline;font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--t);padding-right:60px}
  .bc .ty{border:1px solid currentColor;border-radius:4px;padding:1px 6px;color:var(--ink-soft)}
  .bc .nm{font-family:var(--sketch);font-weight:700;font-size:34px;line-height:1;margin-top:4px;padding-right:60px}
  .bc .ds{margin-top:7px;line-height:1.3;font-weight:500}
  .bc ol{margin:8px 0 0;padding-left:1.45em;line-height:1.3}
  .bc ol li::marker{font-family:var(--mono);color:var(--ink-soft);font-size:.9em}
  .bc .ft{font-size:13px;color:var(--ink-soft);margin-top:6px;line-height:1.25}
  .bc .est{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);margin-top:9px}

  .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px}
  .step{display:flex;gap:14px;padding:14px 16px 13px;align-items:flex-start}
  .step .num{width:44px;height:44px;border-radius:50%;background:var(--rust);color:#fff;font-family:var(--mono);font-size:24px;display:grid;place-items:center;flex:none}
  .step .t{font-family:var(--sketch);font-weight:700;font-size:28px;line-height:1}
  .step .s{font-size:14px;color:var(--ink);margin-top:6px;line-height:1.3}

  .bottom{position:absolute;left:56px;right:56px;bottom:118px;display:flex;justify-content:space-between;align-items:flex-end}
  .bottom .qr svg{width:176px;height:176px}
  .bottom .qr .say{font-size:15px}
  .bottom .qr .say b{font-size:20px;margin-bottom:6px}
  .note{text-align:right;font-family:var(--hand);font-size:29px;color:var(--rust);line-height:1.25;transform:rotate(-2deg);max-width:470px}
  .note small{display:block;font-family:var(--mono);font-size:13.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);margin-top:12px;transform:none}
</style></head>
<body>
<div class="sheet">
  <div class="stamp"><b>BROPHY</b>FPV CLUB<br>FLIGHT CLEARANCE</div>
  <div class="eyebrow"><h2>Flight Clearance &middot; for anyone flying a drone at Brophy, for any purpose</h2><span class="rule"></span></div>
  <div class="hero">
    <div>
      <h1>CERTIFIED.<br><span class="rust">THEN CLEARED.</span></h1>
      <div class="lede">Four badges once, at home, about 45 minutes. Then Mr. Burr&rsquo;s yes before every flight. Club or personal, FPV or not.</div>
    </div>
    <img src="img/drone-cinebot.svg" alt="">
  </div>

  <div class="sec"><h3>1 &middot; The Brophy Drone Certification</h3><span class="rule"></span><span class="hint">once &middot; never expires &middot; all @@N@@ on the website</span></div>
  <div class="badges">@@CARDS@@</div>

  <div class="sec"><h3>2 &middot; Permission</h3><span class="rule"></span><span class="hint">every flight</span></div>
  <div class="steps">@@STEPS@@</div>

  <div class="bottom">
    <div class="qr">
      <svg viewBox="0 0 370 370"><use href="qr-clearance.svg#q"/></svg>
      <div class="say" style="max-width:400px"><b>Scan for Flight Clearance</b>The four badges, your drone portfolio,<br>and Mr. Burr&rsquo;s form, in one place.</div>
    </div>
    <div class="note">Clearance is per drone and per pilot.<br>DJI, whoop or 5-inch: everyone.
      <small>elmagoct.github.io/brophy-fpv-club/clearance/</small></div>
  </div>

  <div class="foot"><span><b>Brophy FPV Club</b> &middot; Flight Clearance</span><span>mtucker27@ for questions</span></div>
</div>
</body></html>
'''

if __name__ == '__main__':
    fs = load_fs()
    with open(os.path.join(HERE, '02-cert.html'), 'w', encoding='utf-8') as f:
        f.write(render(fs))
    print('wrote 02-cert.html (%d badges)' % sum(1 for b in fs['BADGES'] if b['tier'] == 'cl'))
