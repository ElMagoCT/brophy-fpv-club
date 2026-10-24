#!/usr/bin/env python3
"""The landscape behind the trail sheets: a city that becomes a mountain range
with trees as the sheets go on. Drawn as faint ink silhouettes in the paper
palette so the cards stay readable; the ridges continue from sheet to sheet
(the noise is sampled at a global x, so the horizon joins when hung in a row).

    scenery(t, gx, peak)   t: 0 = city .. 1 = mountains; gx: global x offset;
                           peak: (x, y) apex of a tower / summit to stand a gate on
"""
import math

W, H = 1056, 1632
GY = H - 56                      # the ground line
INK = '#1f3350'

def rnd(*k):
    x = math.sin(sum((v + 1) * (12.9898 + 7.7 * i) for i, v in enumerate(k))) * 43758.5453
    return x - math.floor(x)

def f2(v): return ('%.1f' % v).rstrip('0').rstrip('.')

def ridge(gx, tfn, base_fn, amp_fn, freq, phase):
    pts = []
    for x in range(-60, W + 80, 16):
        X = gx + x; t = tfn(x); base = base_fn(t); amp = amp_fn(t)
        y = base - amp * (0.5 + 0.5 * math.sin(X * freq + phase)) - amp * 0.35 * math.sin(X * freq * 2.3 + phase * 1.7)
        y -= t * amp * 0.5 * abs(math.sin(X * freq * 5.1 + phase))     # sharp peaks for mountains
        pts.append((x, y))
    return 'M-60 %s L%s L%s %s Z' % (f2(H + 20), ' '.join('%s %s' % (f2(x), f2(y)) for x, y in pts), f2(W + 80), f2(H + 20))

def pine(x, y, h, op):
    w = h * 0.42
    return ('<g opacity="%s" fill="%s"><rect x="%s" y="%s" width="%s" height="%s"/>'
            '<path d="M%s %sL%s %sL%s %sZ"/><path d="M%s %sL%s %sL%s %sZ"/><path d="M%s %sL%s %sL%s %sZ"/></g>' % (
        f2(op), INK, f2(x - h * .035), f2(y - h * .18), f2(h * .07), f2(h * .18),
        f2(x - w), f2(y - h * .15), f2(x), f2(y - h * .62), f2(x + w), f2(y - h * .15),
        f2(x - w * .8), f2(y - h * .45), f2(x), f2(y - h * .84), f2(x + w * .8), f2(y - h * .45),
        f2(x - w * .55), f2(y - h * .7), f2(x), f2(y - h), f2(x + w * .55), f2(y - h * .7)))

def roundtree(x, y, h, op):
    return ('<g opacity="%s" fill="%s"><rect x="%s" y="%s" width="%s" height="%s"/><circle cx="%s" cy="%s" r="%s"/><circle cx="%s" cy="%s" r="%s"/><circle cx="%s" cy="%s" r="%s"/></g>' % (
        f2(op), INK, f2(x - h * .04), f2(y - h * .4), f2(h * .08), f2(h * .4),
        f2(x), f2(y - h * .62), f2(h * .34), f2(x - h * .22), f2(y - h * .5), f2(h * .24), f2(x + h * .22), f2(y - h * .52), f2(h * .25)))

def building(x, w, h, op, seed):
    out = ['<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity="%s"/>' % (f2(x), f2(GY - h), f2(w), f2(h), INK, f2(op))]
    if rnd(seed, 3) > .55:                                                # a spire or a roof box
        out.append('<rect x="%s" y="%s" width="3" height="%s" fill="%s" opacity="%s"/>' % (f2(x + w / 2 - 1.5), f2(GY - h - 26), 26, INK, f2(op)))
    if rnd(seed, 4) > .5:
        out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity="%s"/>' % (f2(x + w * .25), f2(GY - h - 14), f2(w * .5), 14, INK, f2(op)))
    # window columns, lit paper-coloured
    cols, rows = max(1, int(w // 14)), max(2, int(h // 26))
    win = []
    for c in range(cols):
        for r in range(rows):
            if rnd(seed, c, r) > .45:
                win.append('<rect x="%s" y="%s" width="5" height="8"/>' % (f2(x + 7 + c * 14 - 2.5), f2(GY - h + 12 + r * 26)))
    if win: out.append('<g fill="#f2ece0" opacity=".55">%s</g>' % ''.join(win))
    return ''.join(out)

def scenery(t0, t1, gx, peak=None, seed=1):
    """t runs from t0 at the left edge to t1 at the right edge (0 = city, 1 = mountains)"""
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">' % (W, H, W, H)]
    tfn = lambda x: max(0.0, min(1.0, t0 + (t1 - t0) * x / W))
    tm = (t0 + t1) / 2
    # far and near ridges: barely there in the city, the whole horizon in the mountains
    o.append('<path d="%s" fill="%s" opacity="%s"/>' % (ridge(gx, tfn, lambda t: GY - 60 - 120 * t, lambda t: 90 + 320 * t, 0.0021, 1.3), INK, f2(.055 + .03 * tm)))
    o.append('<path d="%s" fill="%s" opacity="%s"/>' % (ridge(gx, tfn, lambda t: GY - 20 - 60 * t, lambda t: 40 + 230 * t, 0.0034, 4.1), INK, f2(.085 + .035 * tm)))
    # the city: buildings crowd the ground where t is low and thin out as it grows
    x = -30 + 20 * rnd(seed, 11); i = 0
    while x < W + 20 and i < 60:
        t = tfn(x); w = 34 + 60 * rnd(seed, i, 1)
        h = (110 + 300 * rnd(seed, i, 2)) * max(0.0, 1 - t * 1.25)
        if h > 40: o.append(building(x, w, h, .12 + .05 * rnd(seed, i, 5), seed * 100 + i))
        x += w + 8 + 40 * rnd(seed, i, 6) + 260 * t * t; i += 1
    # trees: a few street trees in the city, a forest in the hills, pines in the mountains
    for i in range(40):
        tx = rnd(seed, i, 21) * (W + 60) - 30; t = tfn(tx)
        if rnd(seed, i, 25) > .15 + .85 * t: continue
        th = (34 + 70 * rnd(seed, i, 22)) * (.55 + .6 * t)
        if t < .4 and rnd(seed, i, 23) < .7: o.append(roundtree(tx, GY, th, .13 + .06 * rnd(seed, i, 24)))
        else: o.append(pine(tx, GY, th, .14 + .07 * rnd(seed, i, 24)))
    t = tfn(peak[0]) if peak else tm
    # something tall to stand the gate on, when the gate is at the top of the sheet
    if peak:
        px, py = peak
        if t < .5:
            w = 86
            o.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity=".13"/>' % (f2(px - w / 2), f2(py), f2(w), f2(GY - py), INK))
            o.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity=".13"/>' % (f2(px - w / 2 - 28), f2(py + 120), f2(w + 56), f2(GY - py - 120), INK))
            win = ''.join('<rect x="%s" y="%s" width="5" height="8"/>' % (f2(px - w / 2 + 8 + c * 14), f2(py + 14 + r * 26))
                          for c in range(6) for r in range(int((GY - py - 20) // 26)) if rnd(seed, c, r, 9) > .5)
            o.append('<g fill="#f2ece0" opacity=".5">%s</g>' % win)
        else:
            o.append('<path d="M%s %sL%s %sL%s %sZ" fill="%s" opacity=".12"/>' % (f2(px - 260), f2(GY), f2(px), f2(py), f2(px + 300), f2(GY), INK))
            o.append('<path d="M%s %sL%s %sL%s %sL%s %sL%s %sZ" fill="#f2ece0" opacity=".6"/>' % (
                f2(px - 46), f2(py + 60), f2(px - 20), f2(py + 36), f2(px), f2(py), f2(px + 24), f2(py + 40), f2(px + 52), f2(py + 62)))
    # the ground
    o.append('<rect x="0" y="%s" width="%d" height="%s" fill="%s" opacity=".07"/>' % (f2(GY), W, f2(H - GY), INK))
    o.append('<path d="M0 %sH%d" stroke="%s" stroke-opacity=".3" stroke-width="1.5"/>' % (f2(GY), W, INK))
    o.append('</svg>')
    return ''.join(o)

if __name__ == '__main__':
    with open('preview-scenery.html', 'w') as f:
        f.write('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f2ece0;display:flex">' +
                ''.join('<div style="width:528px;height:816px;overflow:hidden"><div style="transform:scale(.5);transform-origin:0 0">%s</div></div>' % scenery(i * .25, (i + 1) * .25, i * W, peak=(860, 420) if i % 2 else None, seed=i + 1) for i in range(4)))
    print('wrote preview-scenery.html')
