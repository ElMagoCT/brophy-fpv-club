#!/usr/bin/env python3
"""02-cert: the Flight Clearance poster, its own clean modern page on white
(Micah, 2026-10-23: not the trail style). The four badges of the Brophy Drone
Certification come from badges.js (tier 'cl'); the permission steps are the
Flight Clearance page's.

    python3 gen_cert.py && python3 build.py 02-cert
"""
import os
from gen_map import load_fs, requirements, esc, HERE

STEPS = [
  ('Ask Mr. Burr', 'His Google Form, at least 24 hours before you want to fly. One flight, one request. A club meeting is one request for the whole group, filed by a mentor; a personal flight is your own.'),
  ('Bring a spotter', 'Every flight has one, with eyes on the aircraft. Your own drone: anyone you name on the form. A club drone: a mentor is there for the session.'),
  ('Wait for the yes', 'He answers by email. Fly once he approves, and only what you asked for. No answer means no.'),
]

def card(b, fs, n):
    items, foot, rule = requirements(b, fs)
    lis = ''.join('<li>%s</li>' % esc(x) for x in items)
    return ('<div class="bc"><div class="bn">%02d</div><div class="bt"><h3>%s</h3><p>%s</p><ol>%s</ol>%s<div class="est">%s</div></div></div>'
            % (n, esc(b['name']), esc(b['do']), lis, ('<div class="ft">%s</div>' % esc(foot)) if foot else '', esc(b.get('est', ''))))

def render(fs):
    cl = [b for b in fs['BADGES'] if b['tier'] == 'cl']
    cards = ''.join(card(b, fs, i) for i, b in enumerate(cl, 1))
    steps = ''.join('<div class="st"><div class="sn">%d</div><h3>%s</h3><p>%s</p></div>' % (i, esc(t), esc(d)) for i, (t, d) in enumerate(STEPS, 1))
    return TEMPLATE.replace('@@CARDS@@', cards).replace('@@STEPS@@', steps)

TEMPLATE = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Flight Clearance</title>
<link rel="stylesheet" href="poster.css">
<style>
  :root{--ink:#14213d;--soft:#5b6b82;--line:#e3e7ee;--accent:#b0532a;--accent-2:#1c5578}
  html,body{background:#fff}
  body{color:var(--ink);font-family:var(--body)}
  .page{position:relative;width:1056px;height:1632px;padding:72px 72px 60px}
  .kicker{font-family:var(--mono);font-size:13px;letter-spacing:.3em;text-transform:uppercase;color:var(--accent)}
  .hero{display:grid;grid-template-columns:1fr 360px;gap:24px;align-items:center;margin-top:14px}
  h1{font-weight:700;font-size:96px;line-height:.92;letter-spacing:-.025em;margin-top:4px}
  h1 span{color:var(--accent)}
  .sub{font-size:22px;line-height:1.35;color:var(--soft);margin-top:18px;max-width:520px;font-weight:400}
  .hero img{display:block;width:360px;justify-self:end}

  .sec{display:flex;align-items:baseline;gap:16px;margin-top:30px;padding-top:14px;border-top:2px solid var(--ink)}
  .sec .n{font-family:var(--mono);font-size:15px;letter-spacing:.2em;color:var(--accent)}
  .sec h2{font-size:28px;font-weight:600;letter-spacing:-.01em}
  .sec .hint{margin-left:auto;font-size:15px;color:var(--soft)}

  .badges{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
  .bc{display:grid;grid-template-columns:56px 1fr;gap:4px;border:1.5px solid var(--line);border-radius:16px;padding:14px 18px 13px 14px;background:#fff}
  .bn{font-family:var(--mono);font-size:22px;color:var(--accent);line-height:1}
  .bt h3{font-size:26px;font-weight:600;line-height:1.05;letter-spacing:-.01em}
  .bt p{font-size:15px;line-height:1.35;color:var(--ink);margin-top:6px}
  .bt ol{margin:10px 0 0;padding-left:1.3em;font-size:14.5px;line-height:1.35;color:var(--ink)}
  .bt ol li::marker{color:var(--soft);font-family:var(--mono);font-size:.9em}
  .bt .ft{font-size:13px;color:var(--soft);line-height:1.3;margin-top:8px}
  .bt .est{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);margin-top:10px}

  .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:14px}
  .st{border-top:4px solid var(--accent);padding-top:14px}
  .sn{font-family:var(--mono);font-size:34px;line-height:1;color:var(--accent)}
  .st h3{font-size:24px;font-weight:600;margin-top:8px;letter-spacing:-.01em}
  .st p{font-size:14.5px;line-height:1.4;color:var(--ink);margin-top:8px}

  .bottom{position:absolute;left:72px;right:72px;bottom:56px;display:flex;justify-content:space-between;align-items:flex-end;gap:30px}
  .bottom .qr{display:flex;align-items:center;gap:18px}
  .bottom .qr svg{width:124px;height:124px;display:block;border:1.5px solid var(--line);border-radius:12px;padding:8px;background:#fff}
  .bottom .say{font-size:15px;line-height:1.4;color:var(--soft);max-width:300px}
  .bottom .say b{display:block;color:var(--ink);font-size:18px;font-weight:600;margin-bottom:4px}
  .who{text-align:right;font-size:17px;line-height:1.4;color:var(--ink);max-width:400px;font-weight:500}
  .who small{display:block;font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);margin-top:8px}
</style></head>
<body>
<div class="page">
  <div class="kicker">Brophy FPV Club &middot; Flight Clearance</div>
  <div class="hero">
    <div>
      <h1>Cleared<br>to <span>fly.</span></h1>
      <p class="sub">Certification once, permission every flight. For anyone flying any drone at Brophy, for any purpose.</p>
    </div>
    <img src="img/gate-c.svg" alt="">
  </div>

  <div class="sec"><span class="n">01</span><h2>The Brophy Drone Certification</h2><span class="hint">once &middot; about 45 minutes, at home &middot; never expires</span></div>
  <div class="badges">@@CARDS@@</div>

  <div class="sec"><span class="n">02</span><h2>Permission</h2><span class="hint">every flight</span></div>
  <div class="steps">@@STEPS@@</div>

  <div class="bottom">
    <div class="qr"><svg viewBox="0 0 370 370"><use href="qr-clearance.svg#q"/></svg>
      <div class="say"><b>Scan for Flight Clearance</b>The four badges, your drone portfolio and Mr. Burr&rsquo;s form, in one place.</div></div>
    <div class="who">Club or personal, FPV or not, DJI or whoop: everyone. Clearance is per pilot and per drone.<small>elmagoct.github.io/brophy-fpv-club/clearance/</small></div>
  </div>
</div>
</body></html>
'''

if __name__ == '__main__':
    fs = load_fs()
    with open(os.path.join(HERE, '02-cert.html'), 'w', encoding='utf-8') as f:
        f.write(render(fs))
    print('wrote 02-cert.html')
