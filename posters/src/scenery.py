#!/usr/bin/env python3
"""The landscape behind the trail sheets: a neon city that becomes foothills,
forest and a mountain range as the sheets go on. Bold ink silhouettes in
layers (far = pale, near = dark) with neon accents - lit windows, edge strips
and signs on the buildings, rim light on the ridges - and the skyline carried
up to about two thirds of the page. Everything is a function of a global
position t (0 = deep city, 1 = high mountains) sampled per x, so the four
sheets are one continuous panorama when hung in a row.

    scenery(t0, t1, gx, peak, seed)
        t0, t1  t at the left and right edge of this sheet
        gx      global x offset (sheet index * width), keeps the noise continuous
        peak    (x, y) apex of a tower / summit to stand a gate on, or None
"""
import math

W, H = 1056, 1632
GY = H - 4                       # the ground line: the page edge, no strip (Micah, 2026-10-23)
INK = '#1f3350'
NEON = ['#22d3ee', '#f052a0', '#f0a91a', '#7c5cff', '#38e07a']

def rnd(*k):
    x = math.sin(sum((v + 1) * (12.9898 + 7.7 * i) for i, v in enumerate(k))) * 43758.5453
    return x - math.floor(x)

def f2(v): return ('%.1f' % v).rstrip('0').rstrip('.')
def sstep(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

# ----------------------------------------------------------------- ridges
def ridge_pts(gx, tfn, base_fn, amp_fn, freq, phase, jag_fn):
    pts = []
    for x in range(-80, W + 100, 12):
        X = gx + x; t = tfn(x); base = base_fn(t); amp = amp_fn(t); jag = jag_fn(t)
        y = base - amp * (0.5 + 0.5 * math.sin(X * freq + phase)) - amp * 0.35 * math.sin(X * freq * 2.3 + phase * 1.7)
        y -= jag * amp * 0.55 * abs(math.sin(X * freq * 4.7 + phase * .6))     # sharp peaks for mountains
        y -= jag * amp * 0.2 * abs(math.sin(X * freq * 11 + phase * 2.2))
        pts.append((x, y))
    return pts

def ridge_path(pts):
    return 'M-80 %s L%s L%s %s Z' % (f2(H + 20), ' '.join('%s %s' % (f2(x), f2(y)) for x, y in pts), f2(W + 100), f2(H + 20))

def rim_path(pts):
    return 'M' + ' L'.join('%s %s' % (f2(x), f2(y)) for x, y in pts)

def snow(pts, depth, op):
    """snow caps: every local maximum gets a little cap polygon"""
    out = []
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        if y < pts[i - 1][1] and y <= pts[i + 1][1] and y < GY - 420:
            d = depth
            out.append('<path d="M%s %sL%s %sL%s %sL%s %sL%s %sZ" fill="#f6f2ea" opacity="%s"/>' % (
                f2(x - d * 1.1), f2(y + d * .95), f2(x - d * .45), f2(y + d * .55), f2(x), f2(y), f2(x + d * .5), f2(y + d * .6), f2(x + d * 1.15), f2(y + d), f2(op)))
    return ''.join(out)

# ----------------------------------------------------------------- the city
def building(x, w, h, op, seed, t):
    o = []
    top = GY - h
    col = INK
    o.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity="%s"/>' % (f2(x), f2(top), f2(w), f2(h), col, f2(op)))
    kind = rnd(seed, 3)
    if kind > .7:                                                          # a spire
        o.append('<rect x="%s" y="%s" width="4" height="%s" fill="%s" opacity="%s"/>' % (f2(x + w / 2 - 2), f2(top - 60), 60, col, f2(op)))
        o.append('<circle cx="%s" cy="%s" r="3.5" fill="%s"/>' % (f2(x + w / 2), f2(top - 62), '#f052a0'))
    elif kind > .45:                                                       # a stepped crown
        o.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity="%s"/>' % (f2(x + w * .18), f2(top - 30), f2(w * .64), 30, col, f2(op)))
        o.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity="%s"/>' % (f2(x + w * .36), f2(top - 52), f2(w * .28), 22, col, f2(op)))
    else:                                                                  # water tank + antenna
        o.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity="%s"/>' % (f2(x + w * .62), f2(top - 22), f2(w * .22), 22, col, f2(op)))
        o.append('<rect x="%s" y="%s" width="3" height="%s" fill="%s" opacity="%s"/>' % (f2(x + w * .25), f2(top - 44), 44, col, f2(op)))
    # lit windows, warm and cool, denser where it is still the city
    cols, rows = max(1, int((w - 10) // 13)), max(2, int((h - 24) // 22))
    warm, cool = [], []
    lit = .62 - .3 * t
    for c in range(cols):
        for r in range(rows):
            if rnd(seed, c, r) < lit:
                (warm if rnd(seed, c, r, 2) < .55 else cool).append('<rect x="%s" y="%s" width="6" height="9"/>' % (f2(x + 7 + c * 13), f2(top + 14 + r * 22)))
    if warm: o.append('<g fill="#f6c76a" opacity=".85">%s</g>' % ''.join(warm))
    if cool: o.append('<g fill="#9fe7f5" opacity=".8">%s</g>' % ''.join(cool))
    # neon: an edge strip down one side on some towers, a sign band on others
    n = NEON[int(rnd(seed, 7) * len(NEON))]
    if rnd(seed, 8) > .45 and h > 160:
        ex = x + (2 if rnd(seed, 9) > .5 else w - 4)
        o.append('<rect x="%s" y="%s" width="3" height="%s" fill="%s" filter="url(#glow)" opacity=".9"/>' % (f2(ex), f2(top + 6), f2(h - 12), n))
        o.append('<rect x="%s" y="%s" width="3" height="%s" fill="%s"/>' % (f2(ex), f2(top + 6), f2(h - 12), n))
    if rnd(seed, 10) > .55 and h > 220:
        sy = top + h * (.25 + .4 * rnd(seed, 11))
        o.append('<rect x="%s" y="%s" width="%s" height="6" fill="%s" filter="url(#glow)" opacity=".8"/>' % (f2(x - 4), f2(sy), f2(w + 8), n))
        o.append('<rect x="%s" y="%s" width="%s" height="6" fill="%s"/>' % (f2(x - 4), f2(sy), f2(w + 8), n))
    return ''.join(o)

def far_block(x, w, h, op):
    return '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity="%s"/>' % (f2(x), f2(GY - h), f2(w), f2(h), INK, f2(op))

# ----------------------------------------------------------------- trees
def pine(x, y, h, op):
    w = h * .40
    return ('<g opacity="%s" fill="%s"><rect x="%s" y="%s" width="%s" height="%s"/>'
            '<path d="M%s %sL%s %sL%s %sZ"/><path d="M%s %sL%s %sL%s %sZ"/><path d="M%s %sL%s %sL%s %sZ"/></g>' % (
        f2(op), INK, f2(x - h * .035), f2(y - h * .2), f2(h * .07), f2(h * .2),
        f2(x - w), f2(y - h * .16), f2(x), f2(y - h * .62), f2(x + w), f2(y - h * .16),
        f2(x - w * .78), f2(y - h * .46), f2(x), f2(y - h * .85), f2(x + w * .78), f2(y - h * .46),
        f2(x - w * .52), f2(y - h * .7), f2(x), f2(y - h), f2(x + w * .52), f2(y - h * .7)))

def roundtree(x, y, h, op):
    return ('<g opacity="%s" fill="%s"><rect x="%s" y="%s" width="%s" height="%s"/><circle cx="%s" cy="%s" r="%s"/><circle cx="%s" cy="%s" r="%s"/><circle cx="%s" cy="%s" r="%s"/></g>' % (
        f2(op), INK, f2(x - h * .04), f2(y - h * .4), f2(h * .08), f2(h * .4),
        f2(x), f2(y - h * .62), f2(h * .34), f2(x - h * .22), f2(y - h * .5), f2(h * .24), f2(x + h * .22), f2(y - h * .52), f2(h * .25)))

# ----------------------------------------------------------------- the scene
def scenery(t0, t1, gx, peak=None, seed=1, spot=None):
    tfn = lambda x: max(0.0, min(1.0, t0 + (t1 - t0) * x / W))
    tm = (t0 + t1) / 2
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">' % (W, H, W, H),
         '<defs><filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>'
         '<filter id="glow2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter></defs>']
    # sky glow over the city, fading as the city does
    if tm < .6:
        o.append('<ellipse cx="%s" cy="%s" rx="700" ry="320" fill="#f052a0" opacity="%s" filter="url(#glow2)"/>' % (f2(W * .4), f2(GY - 520), f2(.07 * (1 - tm))))
        o.append('<ellipse cx="%s" cy="%s" rx="520" ry="260" fill="#22d3ee" opacity="%s" filter="url(#glow2)"/>' % (f2(W * .75), f2(GY - 440), f2(.06 * (1 - tm))))
    # far range: always there, taller and sharper toward the mountains. Tops average about two thirds up the page.
    far = ridge_pts(gx, tfn, lambda t: GY - 520 - 160 * t, lambda t: 220 + 320 * sstep(t), 0.0017, 1.3, lambda t: .3 + .7 * sstep(t))
    o.append('<path d="%s" fill="%s" opacity=".20"/>' % (ridge_path(far), INK))
    o.append(snow(far, 46, .55 * sstep((tm - .3) * 1.6)))
    o.append('<path d="%s" fill="none" stroke="#7c5cff" stroke-width="2" opacity="%s" filter="url(#glow)"/>' % (rim_path(far), f2(.35)))
    o.append('<path d="%s" fill="none" stroke="#c9b8ff" stroke-width="1.2" opacity="%s"/>' % (rim_path(far), f2(.5)))
    # mid range: hills in the suburbs, a real range later
    mid = ridge_pts(gx, tfn, lambda t: GY - 330 - 120 * t, lambda t: 120 + 300 * sstep(t), 0.0029, 4.1, lambda t: .15 + .85 * sstep(t - .15))
    o.append('<path d="%s" fill="%s" opacity=".32"/>' % (ridge_path(mid), INK))
    o.append(snow(mid, 36, .6 * sstep((tm - .45) * 2)))
    o.append('<path d="%s" fill="none" stroke="#22d3ee" stroke-width="2" opacity=".4" filter="url(#glow)"/>' % rim_path(mid))
    o.append('<path d="%s" fill="none" stroke="#bff3fb" stroke-width="1.2" opacity=".55"/>' % rim_path(mid))
    # far city blocks behind the towers, fading out with t
    x = -60 + 30 * rnd(seed, 31); i = 0
    while x < W + 40 and i < 80:
        t = tfn(x); w = 50 + 90 * rnd(seed, i, 41)
        h = (260 + 380 * rnd(seed, i, 42)) * max(0.0, 1 - 1.05 * sstep(t))
        if h > 24: o.append(far_block(x, w, h, .20 * min(1.0, 2.2 * (1 - t))))
        x += w + 10 + 30 * rnd(seed, i, 43) + 260 * t * t; i += 1
    # the towers: tall in the city (tops near two thirds up), lower and sparser as t grows, gone by the high range
    x = -40 + 40 * rnd(seed, 11); i = 0
    while x < W + 30 and i < 80:
        t = tfn(x); w = 42 + 78 * rnd(seed, i, 1)
        h = (320 + 640 * rnd(seed, i, 2)) * max(0.0, 1 - sstep(t * 1.05)) + 90 * max(0.0, 1 - t * 1.1)
        if h > 24: o.append(building(x, w, h, (.62 - .12 * t) * min(1.0, 2.4 * (1 - t)), seed * 100 + i, t))
        x += w + 6 + 34 * rnd(seed, i, 6) + 300 * t * t; i += 1
    # near ridge: foothills under the forest, coming in from the suburbs on
    near = ridge_pts(gx, tfn, lambda t: GY - 60 - 90 * sstep(t), lambda t: 60 + 240 * sstep(t - .1), 0.0041, 7.3, lambda t: .4 * sstep(t - .3))
    o.append('<path d="%s" fill="%s" opacity=".48"/>' % (ridge_path(near), INK))
    o.append('<path d="%s" fill="none" stroke="#38e07a" stroke-width="2" opacity=".35" filter="url(#glow)"/>' % rim_path(near))
    # trees: street trees in the city, a forest on the hills, big pines in the mountains
    for i in range(70):
        tx = rnd(seed, i, 21) * (W + 80) - 40; t = tfn(tx)
        if rnd(seed, i, 25) > .12 + .88 * sstep(t * 1.2): continue
        th = (50 + 110 * rnd(seed, i, 22)) * (.5 + .8 * t)
        if t < .4 and rnd(seed, i, 23) < .7: o.append(roundtree(tx, GY + 2, th, .55 + .25 * rnd(seed, i, 24)))
        else: o.append(pine(tx, GY + 2, th, .55 + .3 * rnd(seed, i, 24)))
    # something tall to stand the gate on, when the gate is at the top of the sheet
    if peak:
        px, py = peak; t = tfn(px)
        if t < .5:
            w = 110
            o.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity=".6"/>' % (f2(px - w / 2 - 34), f2(py + 160), f2(w + 68), f2(GY - py - 160), INK))
            o.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity=".66"/>' % (f2(px - w / 2), f2(py), f2(w), f2(GY - py), INK))
            win = ''.join('<rect x="%s" y="%s" width="6" height="9"/>' % (f2(px - w / 2 + 9 + c * 13), f2(py + 16 + r * 22))
                          for c in range(7) for r in range(int((GY - py - 24) // 22)) if rnd(seed, c, r, 9) > .45)
            o.append('<g fill="#f6c76a" opacity=".85">%s</g>' % win)
            for ex in (px - w / 2 + 2, px + w / 2 - 5):
                o.append('<rect x="%s" y="%s" width="3" height="%s" fill="#22d3ee" filter="url(#glow)" opacity=".9"/>' % (f2(ex), f2(py + 4), f2(GY - py - 8)))
                o.append('<rect x="%s" y="%s" width="3" height="%s" fill="#22d3ee"/>' % (f2(ex), f2(py + 4), f2(GY - py - 8)))
        else:
            o.append('<path d="M%s %sL%s %sL%s %sZ" fill="%s" opacity=".5"/>' % (f2(px - 300), f2(GY + 2), f2(px), f2(py), f2(px + 340), f2(GY + 2), INK))
            o.append('<path d="M%s %sL%s %sL%s %sL%s %sL%s %sZ" fill="#f6f2ea" opacity=".75"/>' % (
                f2(px - 56), f2(py + 72), f2(px - 24), f2(py + 44), f2(px), f2(py), f2(px + 28), f2(py + 48), f2(px + 62), f2(py + 74)))
            o.append('<path d="M%s %sL%s %sL%s %s" fill="none" stroke="#f052a0" stroke-width="2.5" opacity=".6" filter="url(#glow)"/>' % (f2(px - 300), f2(GY + 2), f2(px), f2(py), f2(px + 340), f2(GY + 2)))
    # a light clearing behind the gate picture, so the drone reads against the skyline
    if spot:
        sx, sy, sr = spot
        o.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#f2ece0" opacity=".72" filter="url(#glow2)"/>' % (f2(sx), f2(sy), f2(sr), f2(sr * .8)))
    o.append('</svg>')
    return ''.join(o)

if __name__ == '__main__':
    with open('preview-scenery.html', 'w') as f:
        f.write('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f2ece0;display:flex">' +
                ''.join('<div style="width:528px;height:816px;overflow:hidden"><div style="transform:scale(.5);transform-origin:0 0">%s</div></div>' % scenery(i * .25, (i + 1) * .25, i * W, peak=(860, 420) if i % 2 else None, seed=i + 1) for i in range(4)))
    print('wrote preview-scenery.html')
