#!/usr/bin/env python3
"""Drone dock sheets: pin one to the wall, write your name on it, hang the drone
on pins pushed through the (+) marks. Text block at the top, the rest of the
sheet is a REAL-SIZE top-view outline of that drone class.

    python3 gen_dock.py        # writes 08..13-dock-*.html, then run build.py

One sheet per drone class x paper size. Everything is in millimetres inside
the SVG (1 user unit = 1 mm), so the outline prints at actual size when the
PDF is printed at 100%.
"""
import os

PAPERS = {           # name, width in, height in
    'letter': (8.5, 11),
    '7x11':   (7.0, 11),
}

# wheelbase (motor-to-motor diagonal), prop diameter, ducted?, body (w x h),
# text fraction of the page height, and the specs that matter for that class
CLASSES = [
  dict(key='whoop', name='TINY WHOOP', sub='65 – 75 mm · Meteor 75 Pro · Tier 1',
       wb=75, prop=40, duct=True, body=(22, 48), top=0.40,
       specs=['Frame / size', 'Motors', 'Battery (1S)', 'FC / ESC', 'Camera / VTX', 'Receiver', 'Weight', 'Props']),
  dict(key='2in', name='TWO INCH', sub='2-inch cinewhoop · Pavo 20 Pro · Tier 2',
       wb=90, prop=51, duct=True, body=(40, 62), top=0.34,
       specs=['Frame / size', 'Motors', 'Battery (3S / 4S)', 'FC / ESC', 'Camera / VTX', 'Receiver', 'Weight', 'Props']),
  dict(key='35in', name='3.5 INCH', sub='3.5-inch cinewhoop · Cinebot 35 · Tier 2',
       wb=150, prop=89, duct=True, body=(56, 86), top=0.25,
       specs=['Frame / size', 'Motors', 'Battery (4S / 6S)', 'FC / ESC', 'Camera / VTX', 'Receiver', 'Weight', 'Props']),
  dict(key='5in', name='FIVE INCH', sub='5-inch freestyle · 225 mm · Tier 2',
       wb=225, prop=127, duct=False, body=(40, 110), top=0.25,
       specs=['Frame', 'Motors (KV)', 'Battery (4S / 6S)', 'FC / ESC', 'Camera / VTX', 'Receiver', 'Weight', 'Props']),
]

INK, RUST, SOFT, LINE = '#1f3350', '#8f3d12', '#546881', 'rgba(31,51,80,.42)'

def drone_svg(c, w_mm, h_mm):
    """A top view centred in a w x h mm box. Front is up."""
    cx, cy = w_mm / 2, h_mm / 2
    half = c['wb'] / 2 / (2 ** .5)              # arm reach along x and y
    mr = 5 if c['key'] == 'whoop' else (9 if c['key'] in ('2in', '35in') else 14)
    reach = half + (c['prop'] / 2 + 4 if c['duct'] else mr)   # ducts count, bare props do not
    scale = min(1.0, (w_mm - 6) / (2 * reach), (h_mm - 8) / (2 * reach))
    motors = [(cx - half, cy - half), (cx + half, cy - half), (cx - half, cy + half), (cx + half, cy + half)]
    bw, bh = c['body']
    o = []
    o.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %.1f %.1f" width="%.2fin" height="%.2fin" style="display:block;overflow:visible">'
             % (w_mm, h_mm, w_mm / 25.4, h_mm / 25.4))
    o.append('<defs><clipPath id="page"><rect x="0" y="0" width="%.1f" height="%.1f"/></clipPath></defs>' % (w_mm, h_mm))
    o.append('<g clip-path="url(#page)" fill="none" stroke="%s" stroke-linecap="round" stroke-linejoin="round">' % INK)
    o.append('<g transform="translate(%.1f %.1f) scale(%.3f) translate(%.1f %.1f)">' % (cx, cy, scale, -cx, -cy))
    # arms
    for (mx, my) in motors:
        o.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width="%.1f"/>' % (cx, cy, mx, my, 2.2 if c['key'] == 'whoop' else 4))
    # props or ducts
    for (mx, my) in motors:
        if c['duct']:
            o.append('<circle cx="%.1f" cy="%.1f" r="%.1f" stroke-width="1.6"/>' % (mx, my, c['prop'] / 2 + 4))
            o.append('<circle cx="%.1f" cy="%.1f" r="%.1f" stroke-width=".7" stroke-dasharray="2 2.5" stroke="%s"/>' % (mx, my, c['prop'] / 2, SOFT))
        else:
            o.append('<circle cx="%.1f" cy="%.1f" r="%.1f" stroke-width=".9" stroke-dasharray="3 3" stroke="%s"/>' % (mx, my, c['prop'] / 2, SOFT))
    # body (opaque, so the arms stop at its edge)
    o.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" stroke-width="1.8" fill="#ffffff"/>' % (cx - bw / 2, cy - bh / 2, bw, bh, min(bw, bh) * .18))
    # camera (front) and battery strap hints
    o.append('<path d="M%.1f %.1f l%.1f %.1f h%.1f z" stroke-width="1.2"/>' % (cx - bw * .28, cy - bh / 2 + bh * .14, bw * .28, -bh * .1, bw * .28))
    o.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width=".9" stroke-dasharray="2 2"/>' % (cx - bw / 2, cy + bh * .18, cx + bw / 2, cy + bh * .18))
    o.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke-width=".9" stroke-dasharray="2 2"/>' % (cx - bw / 2, cy + bh * .36, cx + bw / 2, cy + bh * .36))
    # motors + pin marks
    for (mx, my) in motors:
        o.append('<circle cx="%.1f" cy="%.1f" r="%.1f" stroke-width="1.6" fill="rgba(255,255,255,.9)"/>' % (mx, my, mr))
        o.append('<g stroke="%s" stroke-width="1"><circle cx="%.1f" cy="%.1f" r="2.6"/><line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/><line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/></g>'
                 % (RUST, mx, my, mx - 4.5, my, mx + 4.5, my, mx, my - 4.5, mx, my + 4.5))
    o.append('</g>')
    # front arrow: above the drone when there is room, else tucked in the corner
    top_edge = cy - reach * scale
    if top_edge > 26:
        o.append('<path d="M%.1f %.1f v-10 m-4 4 l4 -4 l4 4" stroke-width="1.2"/>' % (cx, top_edge - 6))
        o.append('<text x="%.1f" y="%.1f" font-family="Share Tech Mono, monospace" font-size="4.2" fill="%s" text-anchor="middle" stroke="none" letter-spacing=".6">FRONT</text>' % (cx, top_edge - 19, SOFT))
    # (no room: the how-line says "front is up" instead - see render())
    size_note = 'ACTUAL SIZE' if scale > 0.995 else 'SCALED TO FIT · %d%%' % round(scale * 100)
    # wheelbase dimension line, bottom-right
    o.append('<text x="%.1f" y="%.1f" font-family="Share Tech Mono, monospace" font-size="3.6" fill="%s" text-anchor="end" stroke="none" letter-spacing=".5">%s · %d MM WHEELBASE · PROPS %d MM</text>'
             % (w_mm - 2, h_mm - 2, SOFT, size_note, c['wb'], c['prop']))
    o.append('</g></svg>')
    return '\n'.join(o), top_edge > 26

def render(c, paper):
    pw, ph = PAPERS[paper]
    W, H = pw * 96, ph * 96                       # css px
    margin = 0.45 * 96
    top_h = H * c['top']
    inner_w = W - 2 * margin
    drone_h_px = H - top_h - margin
    svg, has_arrow = drone_svg(c, inner_w / 96 * 25.4, drone_h_px / 96 * 25.4)
    front = '' if has_arrow else ' &middot; front is up.' 
    cells = ''.join('<div class="cell"><span>%s</span></div>' % s for s in c['specs'])
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Drone dock — {c['name'].title()} — {pw:g}×{ph:g}</title>
<style>
@font-face{{font-family:'Barlow';font-weight:500;src:url(fonts/barlow-500.woff2) format('woff2')}}
@font-face{{font-family:'Barlow';font-weight:600;src:url(fonts/barlow-600.woff2) format('woff2')}}
@font-face{{font-family:'Cabin Sketch';font-weight:700;src:url(fonts/cabin-sketch-700.woff2) format('woff2')}}
@font-face{{font-family:'Share Tech Mono';font-weight:400;src:url(fonts/share-tech-mono-400.woff2) format('woff2')}}
@font-face{{font-family:'Architects Daughter';font-weight:400;src:url(fonts/architects-daughter-400.woff2) format('woff2')}}
@page{{size:{pw}in {ph}in;margin:0}}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:{W:.0f}px;height:{H:.0f}px;overflow:hidden}}
body{{background:#fff;color:{INK};font-family:'Barlow',sans-serif;position:relative;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.grid{{position:absolute;inset:0;opacity:.22;background-image:linear-gradient({LINE} 1px,transparent 1px),linear-gradient(90deg,{LINE} 1px,transparent 1px);background-size:28px 28px}}
.sheet{{position:relative;width:100%;height:100%;padding:{margin:.0f}px}}
.top{{height:{top_h - margin:.0f}px;display:flex;flex-direction:column;gap:{7 if c['top'] < 0.3 else 10}px;border-bottom:2px solid {INK};padding-bottom:10px;margin-bottom:8px}}
.head{{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}}
h1{{font-family:'Cabin Sketch',cursive;font-weight:700;font-size:{(34 if pw < 8 else 40) if c['top'] < 0.3 else (40 if pw < 8 else 46)}px;line-height:.9}}
h1 small{{display:block;font-family:'Share Tech Mono',monospace;font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:{SOFT};margin-top:6px}}
.tag{{font-family:'Share Tech Mono',monospace;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:{RUST};border:2px solid {RUST};padding:6px 10px;text-align:center;line-height:1.3;transform:rotate(-3deg);white-space:nowrap}}
.tag b{{display:block;font-size:13px;letter-spacing:.26em}}
.names{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}
.name{{display:flex;align-items:baseline;gap:8px;border-bottom:1.5px solid {INK};padding-bottom:3px;min-height:34px}}
.name span{{font-family:'Share Tech Mono',monospace;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:{SOFT};white-space:nowrap}}
.specs{{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1.5px solid {INK};flex:1;min-height:64px}}
.cell{{border-right:1px solid {LINE};border-bottom:1px solid {LINE};padding:4px 6px;min-height:{28 if c['top'] < 0.3 else 34}px}}
.cell:nth-child(4n){{border-right:0}}
.cell:nth-child(n+5){{border-bottom:0}}
.cell span{{font-family:'Share Tech Mono',monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:{SOFT}}}
.how{{font-family:'Architects Daughter',cursive;font-size:{11.5 if pw < 8 else 13}px;white-space:nowrap;overflow:hidden;color:{RUST};line-height:1.25}}
.how b{{color:{INK};font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:.16em;font-weight:400}}
.drone{{position:absolute;left:{margin:.0f}px;right:{margin:.0f}px;top:{top_h:.0f}px;bottom:{margin:.0f}px}}
.drone svg{{width:100%;height:100%}}
</style></head>
<body>
<div class="grid"></div>
<div class="sheet">
  <div class="top">
    <div class="head">
      <h1>DRONE DOCK<small>{c['sub']}</small></h1>
      <div class="tag"><b>{c['name']}</b>Brophy FPV Club</div>
    </div>
    <div class="names">
      <div class="name"><span>Pilot</span></div>
      <div class="name"><span>Drone</span></div>
    </div>
    <div class="specs">{cells}</div>
    <div class="how"><b>HOW</b> &nbsp;Pin the sheet up &middot; pins through the <span style="color:{RUST}">&oplus;</span> marks &middot; hang the drone by its arms, props off or facing out{front}</div>
  </div>
  <div class="drone">{svg}</div>
</div>
</body></html>
'''

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    n = 8
    for paper in ('letter', '7x11'):
        for c in CLASSES:
            fn = '%02d-dock-%s-%s.html' % (n, c['key'], paper)
            with open(os.path.join(here, fn), 'w', encoding='utf-8') as f:
                f.write(render(c, paper))
            print('wrote', fn)
            n += 1
