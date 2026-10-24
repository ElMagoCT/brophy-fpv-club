#!/usr/bin/env python3
"""Renders the club's aircraft as shaded SVG "product shots" for the posters,
plus the race gates with the next drone flying through them.

    python3 drones.py          # writes img/drone-*.svg, img/gate-*.svg, preview-drones.html

One camera for everything: the model is built in millimetres (x right, y toward
the viewer, z up), turned YAW degrees and looked at from ELEV degrees above the
horizon. That projection is affine, so a horizontal part is an ordinary plan
drawing inside a <g transform=matrix(...)>, circles come out as ellipses, and
vertical walls are drawn as quads. Light comes from the front-left and above:
front faces bright, right faces dark, cylinder walls graded left to right.
Curved parts (canopy, stick tops) are stacks of thin horizontal slices.

Models (real wheelbases, so they grow like the real fleet):
  radio    the sim rig's gamepad radio                 (Tier 0)
  whoop    BetaFPV Meteor 75 Pro, 75 mm                (Tier 1)
  pavo     BetaFPV Pavo 20 Pro, 2-inch cinewhoop       (Tier 2)
  cinebot  GEPRC Cinebot30, 3-inch cinewhoop           (Tier 3, with the 5-inch)
  five     5-inch freestyle quad, 225 mm
SPAN_MM is the projected width of each, for sizing <img> tags consistently.
"""
import math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, 'img')

YAW = math.radians(28)
ELEV = math.radians(52)
K, C = math.sin(ELEV), math.cos(ELEV)
LIGHT = (-0.55, 0.83)          # in the turned plan: from the left and the front

def rot(x, y, yaw=None):
    yaw = YAW if yaw is None else yaw
    cs, sn = math.cos(yaw), math.sin(yaw)
    return x * cs - y * sn, x * sn + y * cs

def shade(col, f):
    col = col.lstrip('#')
    r, g, b = (int(col[i:i + 2], 16) for i in (0, 2, 4))
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v * f)))) for v in (r, g, b))

def f2(v): return ('%.2f' % v).rstrip('0').rstrip('.')

class Scene:
    def __init__(self, yaw=None):
        self.out, self.defs, self._grad = [], [], {}
        self.off = (0, 0, 0)
        self.yaw = YAW if yaw is None else yaw      # the product shots turn 28 deg; the gate scenes -45 deg, so the drone flies screen-right
        self.bbox = [1e9, 1e9, -1e9, -1e9]

    def rot(self, x, y): return rot(x, y, self.yaw)

    # ---- projection
    def P(self, x, y, z):
        x, y, z = x + self.off[0], y + self.off[1], z + self.off[2]
        xr, yr = self.rot(x, y)
        X, Y = xr, yr * K - z * C
        b = self.bbox; b[0] = min(b[0], X); b[1] = min(b[1], Y); b[2] = max(b[2], X); b[3] = max(b[3], Y)
        return X, Y

    def layer(self, z, cx=0, cy=0):
        """transform for a horizontal plane at height z, origin at plan (cx, cy)"""
        X, Y = self.P(cx, cy, z)
        cs, sn = math.cos(self.yaw), math.sin(self.yaw)
        return 'matrix(%.4f %.4f %.4f %.4f %.2f %.2f)' % (cs, sn * K, -sn, cs * K, X, Y)

    def face(self, x, y, z, nx, ny):
        """transform for a vertical plane through (x,y,z) with plan normal (nx,ny):
        u runs along the face to the right, v runs up"""
        X, Y = self.P(x, y, z)
        n = math.hypot(nx, ny); nx, ny = nx / n, ny / n
        tx, ty = -ny, nx                       # tangent, to the right when facing the normal... pick the one that goes right on screen
        ux, uy = self.rot(tx, ty)
        if ux < 0: ux, uy, tx, ty = -ux, -uy, -tx, -ty
        return 'matrix(%.4f %.4f 0 %.4f %.2f %.2f)' % (ux, uy * K, -C, X, Y)

    def mark(self, x, y, z): self.P(x, y, z)   # grow the bbox without drawing

    def mark_circle(self, cx, cy, z, r):
        """grow the bbox by the projected ellipse of a horizontal circle"""
        X, Y = self.P(cx, cy, z)
        b = self.bbox; b[0] = min(b[0], X - r); b[1] = min(b[1], Y - r * K); b[2] = max(b[2], X + r); b[3] = max(b[3], Y + r * K)

    # ---- gradients (object bounding box, shared by colour)
    def grad(self, kind, col):
        key = (kind, col)
        if key in self._grad: return self._grad[key]
        gid = 'g%d' % (len(self._grad) + 1)
        self._grad[key] = gid
        if kind == 'wall':      # vertical cylinder wall, lit from the left
            stops = [(0, 1.38), (.22, 1.14), (.55, .88), (.82, .64), (1, .52)]
            g = '<linearGradient id="%s">%s</linearGradient>'
        elif kind == 'inner':   # the inside back wall of a duct: shadowed, lit on the right
            stops = [(0, .52), (.5, .66), (1, .92)]
            g = '<linearGradient id="%s">%s</linearGradient>'
        elif kind == 'top':     # a flat top, a touch lighter toward the back-left
            stops = [(0, 1.18), (1, .88)]
            g = '<linearGradient id="%s" x1="0" y1="0" x2="1" y2="1">%s</linearGradient>'
        elif kind == 'blade':   # prop blade: dark root, bright mid, dark tip
            stops = [(0, .70), (.45, 1.25), (1, .85)]
            g = '<linearGradient id="%s">%s</linearGradient>'
        elif kind == 'bell':    # a motor bell top: radial, bright centre ring
            stops = [(0, .9), (.55, 1.35), (.75, .75), (1, 1.0)]
            g = '<radialGradient id="%s">%s</radialGradient>'
        elif kind == 'lens':
            stops = [(0, 0.5), (.6, 0.9), (1, 2.2)]
            g = '<radialGradient id="%s" cx=".4" cy=".35" r=".7">%s</radialGradient>'
        else: raise ValueError(kind)
        self.defs.append(g % (gid, ''.join('<stop offset="%s" stop-color="%s"/>' % (f2(o), shade(col, f)) for o, f in stops)))
        return gid

    def carbon(self):
        if 'cf' not in self._grad:
            self._grad['cf'] = 'cf'
            self.defs.append(
                '<pattern id="cf" patternUnits="userSpaceOnUse" width="4" height="4">'
                '<rect width="4" height="4" fill="#2b2e33"/>'
                '<rect width="2" height="2" fill="#3a3e45"/><rect x="2" y="2" width="2" height="2" fill="#3a3e45"/>'
                '<path d="M0 2h2M2 4h2" stroke="#484d55" stroke-width=".5"/></pattern>')
            self.defs.append('<linearGradient id="cfsheen" x1="0" y1="0" x2="1" y2="1">'
                             '<stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/>'
                             '<stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>')
        return 'url(#cf)'

    # ---- primitives
    def ellipse(self, cx, cy, z, r, fill, extra=''):
        X, Y = self.P(cx, cy, z)
        self.mark_circle(cx, cy, z, r)
        self.out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"%s/>' % (f2(X), f2(Y), f2(r), f2(r * K), fill, extra))

    def wall_path(self, X, Y0, Y1, r):
        ry = r * K
        return 'M%s %sA%s %s 0 0 0 %s %sL%s %sA%s %s 0 0 1 %s %sZ' % (
            f2(X - r), f2(Y0), f2(r), f2(ry), f2(X + r), f2(Y0), f2(X + r), f2(Y1), f2(r), f2(ry), f2(X - r), f2(Y1))

    def cyl(self, cx, cy, r, z0, z1, col, top=None, top_fill=None):
        X, Y0 = self.P(cx, cy, z0); _, Y1 = self.P(cx, cy, z1)
        self.mark_circle(cx, cy, z0, r); self.mark_circle(cx, cy, z1, r)
        self.out.append('<path d="%s" fill="url(#%s)"/>' % (self.wall_path(X, Y0, Y1, r), self.grad('wall', col)))
        if top is not False:
            self.out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (
                f2(X), f2(Y1), f2(r), f2(r * K), top_fill or ('url(#%s)' % self.grad('top', top or shade(col, 1.1)))))

    def duct_back(self, cx, cy, ro, ri, z0, z1, col, floor=None):
        """inside back wall and floor of a duct - draw, then the motor and prop, then duct_front"""
        X, Y0 = self.P(cx, cy, z0); _, Y1 = self.P(cx, cy, z1)
        ry = ri * K
        d = 'M%s %sA%s %s 0 0 1 %s %sL%s %sA%s %s 0 0 0 %s %sZ' % (
            f2(X - ri), f2(Y1), f2(ri), f2(ry), f2(X + ri), f2(Y1), f2(X + ri), f2(Y0), f2(ri), f2(ry), f2(X - ri), f2(Y0))
        self.out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (f2(X), f2(Y0), f2(ri), f2(ry), floor or shade(col, .55)))
        self.out.append('<path d="%s" fill="url(#%s)"/>' % (d, self.grad('inner', col)))

    def duct_front(self, cx, cy, ro, ri, z0, z1, col, rim=None):
        X, Y0 = self.P(cx, cy, z0); _, Y1 = self.P(cx, cy, z1)
        self.mark_circle(cx, cy, z0, ro); self.mark_circle(cx, cy, z1, ro)
        self.out.append('<path d="%s" fill="url(#%s)"/>' % (self.wall_path(X, Y0, Y1, ro), self.grad('wall', col)))
        ring = ('M%s %sa%s %s 0 1 0 %s 0a%s %s 0 1 0 %s 0ZM%s %sa%s %s 0 1 0 %s 0a%s %s 0 1 0 %s 0Z' % (
            f2(X - ro), f2(Y1), f2(ro), f2(ro * K), f2(2 * ro), f2(ro), f2(ro * K), f2(-2 * ro),
            f2(X - ri), f2(Y1), f2(ri), f2(ri * K), f2(2 * ri), f2(ri), f2(ri * K), f2(-2 * ri)))
        self.out.append('<path d="%s" fill-rule="evenodd" fill="url(#%s)"/>' % (ring, self.grad('top', rim or shade(col, 1.25))))
        # a thin highlight on the back of the rim
        self.out.append('<path d="M%s %sA%s %s 0 0 1 %s %s" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width=".8"/>' % (
            f2(X - (ro + ri) / 2), f2(Y1), f2((ro + ri) / 2), f2((ro + ri) / 2 * K), f2(X + (ro + ri) / 2), f2(Y1)))

    def prism(self, pts, z0, z1, col, top=None, top_fill=None, rx=0):
        """a vertical prism over a plan polygon: visible side faces, then the top"""
        n = len(pts)
        cxm = sum(p[0] for p in pts) / n; cym = sum(p[1] for p in pts) / n
        faces = []
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            nx, ny = b[1] - a[1], -(b[0] - a[0])
            if (a[0] - cxm) * nx + (a[1] - cym) * ny < 0: nx, ny = -nx, -ny
            ln = math.hypot(nx, ny) or 1; nx, ny = nx / ln, ny / ln
            nxr, nyr = self.rot(nx, ny)
            if nyr <= 0.02: continue
            lit = max(0.0, nxr * LIGHT[0] + nyr * LIGHT[1])
            f = 0.55 + 0.62 * lit
            q = [self.P(a[0], a[1], z0), self.P(b[0], b[1], z0), self.P(b[0], b[1], z1), self.P(a[0], a[1], z1)]
            faces.append((nyr, '<path d="M%s" fill="%s"/>' % ('L'.join('%s %s' % (f2(X), f2(Y)) for X, Y in q), shade(col, f))))
        for _, s in sorted(faces): self.out.append(s)
        if top is not False:
            d = 'M' + 'L'.join('%s %s' % (f2(x), f2(y)) for x, y in pts) + 'Z'
            self.out.append('<path d="%s" transform="%s" fill="%s"/>' % (d, self.layer(z1), top_fill or ('url(#%s)' % self.grad('top', top or shade(col, 1.12)))))

    def box(self, x0, y0, x1, y1, z0, z1, col, **kw):
        self.prism([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1, col, **kw)

    def rbox(self, cx, cy, w, h, z0, z1, col, r=3, **kw):
        """a box with rounded plan corners (polygonised)"""
        pts = []
        for (sx, sy, a0) in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
            for k in range(6):
                a = math.radians(a0 + k * 18)
                pts.append((cx + sx * (w / 2 - r) + r * math.cos(a), cy + sy * (h / 2 - r) + r * math.sin(a)))
        self.prism(pts, z0, z1, col, **kw)

    def plate(self, cx, cy, w, h, z0, z1, r=6):
        """a carbon plate: dark edge, weave on top with a sheen"""
        pts = []
        for (sx, sy, a0) in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
            for k in range(6):
                a = math.radians(a0 + k * 18)
                pts.append((cx + sx * (w / 2 - r) + r * math.cos(a), cy + sy * (h / 2 - r) + r * math.sin(a)))
        self.prism(pts, z0, z1, '#1d1f22', top_fill=self.carbon())
        d = 'M' + 'L'.join('%s %s' % (f2(x), f2(y)) for x, y in pts) + 'Z'
        self.out.append('<path d="%s" transform="%s" fill="url(#cfsheen)"/>' % (d, self.layer(z1)))

    def arm(self, x0, y0, x1, y1, w, z0, z1, over=0, carbon=True, col='#1d1f22'):
        dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L
        px, py = -uy * w / 2, ux * w / 2
        x1, y1 = x1 + ux * over, y1 + uy * over
        pts = [(x0 + px, y0 + py), (x1 + px, y1 + py), (x1 - px, y1 - py), (x0 - px, y0 - py)]
        self.prism(pts, z0, z1, col, top_fill=self.carbon() if carbon else None)
        if carbon:
            d = 'M' + 'L'.join('%s %s' % (f2(x), f2(y)) for x, y in pts) + 'Z'
            self.out.append('<path d="%s" transform="%s" fill="url(#cfsheen)"/>' % (d, self.layer(z1)))

    def dome(self, cx, cy, z0, z1, w, h, col, n=22, flat=0.55, power=2.2, spec=True):
        """a smooth hump over an ellipse w x h: slices shrink toward the top"""
        for i in range(n + 1):
            t = i / n
            s = (1 - t ** power) ** 0.5 * (1 - flat) + flat * (1 - t ** 8) if i < n else flat * 0.92
            z = z0 + (z1 - z0) * t
            f = 0.62 + 0.62 * t
            self.ellipse_wh(cx, cy, z, w / 2 * s, h / 2 * s, shade(col, f))
        if spec:
            X, Y = self.P(cx - w * 0.16, cy - h * 0.12, z1)
            self.out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="#fff" fill-opacity=".30"/>' % (
                f2(X), f2(Y), f2(w * 0.17 * flat), f2(h * 0.11 * flat * K)))

    def ellipse_wh(self, cx, cy, z, rx, ry, fill):
        self.out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" transform="%s" fill="%s"/>' % (
            f2(cx), f2(cy), f2(rx), f2(ry), self.layer(z), fill))
        self.mark_circle(cx, cy, z, max(rx, ry))

    def motor(self, cx, cy, r, z0, z1, col='#44484e', ring=None):
        self.cyl(cx, cy, r * 0.55, z0, z0 + (z1 - z0) * 0.25, shade(col, .7))        # base / stator
        self.cyl(cx, cy, r, z0 + (z1 - z0) * 0.25, z1, col, top_fill='url(#%s)' % self.grad('bell', shade(col, .95)))
        X, Y = self.P(cx, cy, z1)
        if ring:
            self.out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="none" stroke="%s" stroke-width="%s"/>' % (
                f2(X), f2(Y), f2(r * .78), f2(r * .78 * K), ring, f2(r * .16)))
        self.out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="%s"/>' % (f2(X), f2(Y), f2(r * .18), f2(r * .18 * K), shade(col, .55)))

    def prop(self, cx, cy, z, r, col, blades=3, angle=0, opacity=.92, hub=None):
        d = ('M%s %s C%s %s %s %s %s %s C%s %s %s %s %s %s C%s %s %s %s %s %sZ' % tuple(f2(v) for v in (
            0.10 * r, -0.035 * r, 0.33 * r, -0.21 * r, 0.74 * r, -0.19 * r, 1.0 * r, -0.05 * r,
            1.05 * r, -0.02 * r, 1.05 * r, 0.035 * r, 1.0 * r, 0.06 * r,
            0.70 * r, 0.13 * r, 0.33 * r, 0.12 * r, 0.10 * r, 0.045 * r)))
        g = self.grad('blade', col)
        parts = ''.join('<path d="%s" transform="rotate(%s)" fill="url(#%s)"/>' % (d, f2(angle + i * 360 / blades), g) for i in range(blades))
        # a bright leading-edge line on each blade
        parts += ''.join('<path d="M%s %s C%s %s %s %s %s %s" transform="rotate(%s)" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="%s"/>' % (
            f2(0.12 * r), f2(-0.04 * r), f2(0.33 * r), f2(-0.2 * r), f2(0.74 * r), f2(-0.18 * r), f2(0.98 * r), f2(-0.05 * r),
            f2(angle + i * 360 / blades), f2(r * .012)) for i in range(blades))
        self.out.append('<g transform="%s" opacity="%s">%s<circle r="%s" fill="%s"/><circle r="%s" fill="%s"/></g>' % (
            self.layer(z, cx, cy), f2(opacity), parts, f2(r * .11), hub or shade(col, .5), f2(r * .035), '#111'))
        self.mark_circle(cx, cy, z, r * 1.06)

    def line3(self, x0, y0, z0, x1, y1, z1, w, col, cap='round'):
        A, B = self.P(x0, y0, z0), self.P(x1, y1, z1)
        self.out.append('<path d="M%s %sL%s %s" stroke="%s" stroke-width="%s" stroke-linecap="%s" fill="none"/>' % (
            f2(A[0]), f2(A[1]), f2(B[0]), f2(B[1]), col, f2(w), cap))

    def antenna(self, x0, y0, z0, x1, y1, z1, w=1.2, tube=0.3, col='#1a1a1a', tip='#e9e9e9'):
        self.line3(x0, y0, z0, x1, y1, z1, w, col)
        if tube:
            t = 1 - tube
            self.line3(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, x1, y1, z1, w * 2.2, tip)

    def lens(self, x, y, z, nx, ny, r, col='#0d1117'):
        """a camera lens on a vertical face through (x,y,z)"""
        T = self.face(x, y, z, nx, ny)
        self.out.append('<g transform="%s"><circle r="%s" fill="%s"/><circle r="%s" fill="url(#%s)"/>'
                        '<circle cx="%s" cy="%s" r="%s" fill="#fff" fill-opacity=".55"/></g>' % (
            T, f2(r), shade(col, 1.6), f2(r * .78), self.grad('lens', '#1c2a3a'), f2(-r * .3), f2(-r * .3), f2(r * .16)))

    def group(self, attrs):
        self.out.append('<g %s>' % attrs)
    def end(self):
        self.out.append('</g>')

    def ring(self, cx, cy, z, ro, ri, fill):
        """a flat annulus at height z"""
        X, Y = self.P(cx, cy, z)
        self.out.append('<path d="M%s %sa%s %s 0 1 0 %s 0a%s %s 0 1 0 %s 0ZM%s %sa%s %s 0 1 0 %s 0a%s %s 0 1 0 %s 0Z" fill-rule="evenodd" fill="%s"/>' % (
            f2(X - ro), f2(Y), f2(ro), f2(ro * K), f2(2 * ro), f2(ro), f2(ro * K), f2(-2 * ro),
            f2(X - ri), f2(Y), f2(ri), f2(ri * K), f2(2 * ri), f2(ri), f2(ri * K), f2(-2 * ri), fill))
        self.P(cx - ro, cy - ro, z); self.P(cx + ro, cy + ro, z)

    def struts(self, cx, cy, r, z0, z1, n, col, w=1.6, phase=0):
        """n vertical posts around a circle (the skeleton of a translucent duct)"""
        for k in range(n):
            a = math.radians(phase + k * 360 / n)
            x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
            self.line3(x, y, z0, x, y, z1, w, col, cap='butt')

    def shadow(self, spots, z=-0.5):
        """soft ground shadow: a blurred blob per spot (cx, cy, r)"""
        if 'blur' not in self._grad:
            self._grad['blur'] = 1
            self.defs.append('<filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>')
        keep = self.off; self.off = (keep[0], keep[1], 0)      # the shadow lies on the floor, however high the drone is
        self.out.append('<g filter="url(#blur)" opacity="%s">' % f2(.17 if keep[2] < 1 else .10))
        for cx, cy, r in spots:
            self.ellipse(cx + r * .18, cy - r * .12, z, r * .8, '#1f3350')
        self.out.append('</g>')
        self.off = keep

    # ---- output
    def svg(self, pad=10, extra_top=0):
        x0, y0, x1, y1 = self.bbox
        x0 -= pad; y0 -= pad + extra_top; x1 += pad; y1 += pad
        w, h = x1 - x0, y1 - y0
        return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s" width="%s" height="%s">'
                '<defs>%s</defs>%s</svg>' % (f2(x0), f2(y0), f2(w), f2(h), f2(w), f2(h), ''.join(self.defs), ''.join(self.out)))

# ---------------------------------------------------------------- helpers
_SCENE = [None]     # the scene being drawn, for depth sorting at its yaw
def corners(a):
    """the four motor positions of an X quad with half-offset a, far to near"""
    pts = [(-a, -a), (a, -a), (-a, a), (a, a)]
    yaw = _SCENE[0].yaw if _SCENE[0] else YAW
    return sorted(pts, key=lambda p: rot(*p, yaw=yaw)[1])

def spokes(s, x, y, ri, z, col, n=3, w=1.8, phase=90):
    for k in range(n):
        ang = math.radians(phase + k * 360 / n)
        s.line3(x, y, z, x + math.cos(ang) * ri, y + math.sin(ang) * ri, z, w, col, cap='butt')

ALU = '#aab2bb'
CLEAR = '#c9d6e0'          # clear props
SMOKE = '#8e969e'          # smoke-grey props

# ---------------------------------------------------------------- the models
# Drawn from the product photos Micah sent (2026-10-23): lightly simplified,
# but each one's real colours and silhouette.

def whoop(s):
    """BetaFPV Meteor 75 Pro: 75 mm, translucent light-grey skeleton ducts,
    bright blue canopy with the camera in its nose, clear props, blue motor rings"""
    a = 75 / (2 * math.sqrt(2))
    ro, ri, zd = 24.0, 22.4, 12
    GREY, GREY2 = '#c4c7cb', '#d9dcdf'
    s.shadow([(x, y, ro) for x, y in corners(a)] + [(0, 2, 18)])
    for x, y in corners(a): s.arm(0, 0, x, y, 9, 0, 4, carbon=False, col=GREY)
    s.rbox(0, 0, 30, 40, 0, 5, GREY, r=6)
    for i, (x, y) in enumerate(corners(a)):
        # skeleton duct: a bottom ring, three posts, a translucent wall, a top ring
        s.ring(x, y, 0.5, ro, ri - 1.5, shade(GREY, .9))
        spokes(s, x, y, ri, 1.2, shade(GREY, .85), n=3, w=1.8, phase=30)
        s.motor(x, y, 6.2, 1.2, 8.2, col='#6c7178', ring='#2f9de8')
        s.prop(x, y, 10.2, 20, CLEAR, blades=3, angle=20 + i * 47, opacity=.62)
        s.group('opacity=".42"'); s.duct_front(x, y, ro, ri, 0.5, zd, GREY2, rim=GREY2); s.end()
        s.struts(x, y, ro - 0.8, 0.5, zd, 3, shade(GREY, .92), w=1.6, phase=150)
        s.ring(x, y, zd, ro, ri - 1.6, GREY2)
    # the stack, a 1S pack in the nose, and the canopy over them
    s.rbox(0, -2, 24, 24, 5, 7.5, '#2a4a33', r=2)
    s.rbox(0, 13, 12, 28, 2, 8, '#3b4a8a', r=3)
    s.dome(0, 0, 5, 20, 30, 46, '#2f9de8', n=26, flat=.46, power=1.7)
    s.box(-6.5, 20, 6.5, 27, 7.5, 16, '#1b1d20')
    s.lens(0, 27, 12, 0, 1, 3.8)
    s.antenna(0, -17, 15, -2, -30, 36, w=2.2, tube=0, col='#1e2024')
    return s

def pavo(s):
    """BetaFPV Pavo 20 Pro: 2-inch cinewhoop, charcoal ducts, carbon deck, DJI O4 Pro
    air unit with fins, camera in a TPU nose, two tall antennas with fat tips"""
    a = 92 / (2 * math.sqrt(2))
    ro, ri, zd = 29.0, 27.0, 22
    CH = '#454a51'
    s.shadow([(x, y, ro) for x, y in corners(a)] + [(0, 0, 26)])
    s.plate(0, 0, 60, 86, 0, 2.2, r=8)
    for x, y in corners(a): s.arm(0, 0, x, y, 14, 2, 6, carbon=False, col=CH)
    s.rbox(0, 0, 40, 54, 2, 15, CH, r=5)
    for i, (x, y) in enumerate(corners(a)):
        s.duct_back(x, y, ro, ri, 2, zd, CH, floor=shade(CH, .7))
        spokes(s, x, y, ri, 3.5, shade(CH, .75), n=3, w=2.4)
        s.motor(x, y, 8.5, 3.5, 13.5, col='#7a8088', ring='#c23a3a')
        s.prop(x, y, 18, 25.4, CLEAR, blades=3, angle=10 + i * 53, opacity=.6)
        s.duct_front(x, y, ro, ri, 2, zd, CH, rim=shade(CH, 1.35))
    s.plate(0, -2, 46, 62, 15, 17.5, r=5)
    s.rbox(0, -8, 32, 30, 17.5, 27, '#3c4047', r=2)
    for k in range(7):
        y = -8 - 12 + k * 4
        s.box(-13, y - .7, 13, y + .7, 27, 29.5, '#5c626b')
    s.rbox(0, -8, 22, 10, 29.5, 30.2, '#8a9098', r=1)          # the BETAFPV plate
    s.rbox(0, 26, 20, 16, 14, 28, '#2a2d32', r=3)
    s.lens(0, 34, 21, 0, 1, 5.8)
    for sx in (-1, 1):
        s.antenna(sx * 10, -24, 17, sx * 15, -36, 58, w=2.0, tube=0, col='#2a2d32')
        s.cyl(sx * 15, -36, 4.2, 58, 70, '#2f3338')
    return s

def cinebot(s):
    """GEPRC Cinebot (25 / 30 class): black ducts with orange accents and a green
    rim stripe, carbon plates, battery on top under a strap, camera in a cage"""
    a = 127 / (2 * math.sqrt(2))
    ro, ri, zd = 42.5, 40.0, 16
    BK = '#33373c'; OR = '#e8792a'
    s.shadow([(x, y, ro) for x, y in corners(a)] + [(0, 0, 40)])
    s.plate(0, 0, 66, 104, 0, 3, r=10)
    for x, y in corners(a): s.arm(0, 0, x, y, 11, 0, 4)
    for i, (x, y) in enumerate(corners(a)):
        s.duct_back(x, y, ro, ri, 4, zd + 4, BK, floor=shade(BK, .7))
        spokes(s, x, y, ri, 5, shade(BK, .8), n=3, w=2.8)
        s.motor(x, y, 10, 4.5, 17.5, col='#6c7178', ring='#c97a2a')
        s.prop(x, y, 19, 38, SMOKE, blades=3, angle=5 + i * 61, opacity=.7)
        s.duct_front(x, y, ro, ri, 4, zd + 4, BK, rim=shade(BK, 1.3))
        # the green edge stripe and an orange accent on the outer rim
        X, Y = s.P(x, y, zd + 4)
        s.out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" fill="none" stroke="#7fb36a" stroke-opacity=".8" stroke-width=".9"/>' % (f2(X), f2(Y), f2(ro - .6), f2((ro - .6) * K)))
        ax, ay = x + (x / abs(x)) * (ro - 1.4), y + (y / abs(y)) * 2
        s.out.append('<path d="M%s %sl%s %sl%s %sz" transform="%s" fill="%s"/>' % (f2(ax), f2(ay), f2(-(x / abs(x)) * 6), f2(-4), 0, f2(8), s.layer(zd + 4.2), OR))
    s.rbox(0, -10, 30, 30, 6, 21, '#3c4047', r=2)
    for x, y in ((-22, -40), (22, -40), (-22, 38), (22, 38)): s.cyl(x, y, 2.6, 4, 24, ALU)
    s.plate(0, 0, 60, 98, 24, 27, r=8)
    s.rbox(0, -6, 36, 74, 27, 55, '#2c2f34', r=3)
    s.rbox(0, -6, 30, 50, 55, 55.6, '#4a5568', r=2)
    s.rbox(0, -6, 37.6, 18, 26.6, 55.9, '#1f2124', r=1)
    s.rbox(0, 46, 24, 18, 8, 26, '#2a2d32', r=3)
    s.lens(0, 55, 17, 0, 1, 7)
    s.antenna(-12, -48, 25, -22, -66, 72, w=2.2, tube=0, col='#2a2d32')
    s.cyl(-22, -66, 4.6, 72, 86, '#2f3338')
    return s

def five(s, variant='a'):
    """a 5-inch freestyle quad. 'a': Axis Flying style, black carbon true-X with
    teal TPU (motor guards, camera cage, antenna mount), smoke props, XT60.
    'b': the club's other 5-inch - orange TPU, an action camera up front, two
    antennas, pale props, a wider 235 mm frame."""
    B = variant == 'b'
    a = (235 if B else 225) / (2 * math.sqrt(2))
    TEAL = '#ff7a1a' if B else '#3dc7d6'
    s.shadow([(x, y, 66) for x, y in corners(a)] + [(0, 0, 60)])
    far = corners(a)
    for x, y in far: s.arm(0, 0, x, y, 13, 0, 6, over=14)
    s.plate(0, 0, 50, 132, 6, 9, r=8)
    def mp(i, x, y):
        s.rbox(x + (x / abs(x)) * 6, y + (y / abs(y)) * 6, 20, 20, 0, 6.5, TEAL, r=5)   # teal arm guard under the motor
        s.motor(x, y, 14, 6, 25, col='#6c7178', ring='#2f3338')
        s.prop(x, y, 27, 64, '#b9c7d2' if B else SMOKE, blades=3, angle=15 + i * 49, opacity=.66)
    for i, (x, y) in enumerate(far[:2]): mp(i, x, y)
    s.rbox(0, -18, 32, 32, 9, 26, '#3c4047', r=2)
    for x, y in ((-18, -54), (18, -54), (-18, 52), (18, 52)): s.cyl(x, y, 3, 9, 31, ALU)
    s.plate(0, 0, 48, 138, 31, 34, r=8)
    s.rbox(0, -10, 44, 70, 34, 66, '#2c2f34', r=4)                 # battery
    s.rbox(0, -10, 36, 46, 66, 66.6, '#8f3d12' if B else '#4a5568', r=2)
    s.rbox(0, -10, 45.6, 20, 33.6, 66.9, '#1f2124', r=1)           # strap
    s.rbox(0, -58, 10, 12, 34, 42, '#f2c230', r=2)                 # XT60
    s.rbox(0, 62, 26, 20, 10, 32, TEAL, r=4)                        # camera cage
    s.lens(0, 72, 21, 0, 1, 7.5)
    if B:                                                           # an action camera on the nose
        s.rbox(0, 54, 44, 30, 34, 70, '#2b2e33', r=4)
        s.lens(-10, 69, 56, 0, 1, 9.5, col='#0a0d12')
        s.rbox(0, 50, 36, 10, 70, 72, TEAL, r=2)
    else:
        s.rbox(0, 56, 40, 16, 34, 44, TEAL, r=3)                    # action-camera mount
    for i, (x, y) in enumerate(far[2:], 2): mp(i, x, y)
    s.rbox(0, -68, 14, 10, 34, 44, TEAL, r=2)                       # antenna mount
    if B:
        for sx in (-1, 1):
            s.antenna(sx * 6, -70, 44, sx * 26, -96, 96, w=2.4, tube=0, col='#2a2d32')
            s.cyl(sx * 26, -96, 4.6, 96, 110, '#2f3338')
    else:
        s.antenna(0, -70, 44, 8, -92, 100, w=2.4, tube=0, col='#2a2d32')
        s.cyl(8, -92, 5, 100, 116, '#2f3338')
    return s

def five_b(s): return five(s, 'b')

def radio(s):
    """the sim rig's gamepad-style radio: two gimbals, switches, a screen"""
    s.shadow([(-45, 0, 46), (45, 0, 46), (0, 0, 40)])
    BODY = '#4a4f57'
    for sx in (-1, 1): s.dome(sx * 62, 10, 0, 30, 60, 78, BODY, n=18, flat=.72, power=2.6, spec=False)
    s.dome(0, 0, 0, 34, 150, 84, shade(BODY, 1.05), n=22, flat=.80, power=2.4, spec=False)
    s.ellipse_wh(0, 0, 34.2, 150 / 2 * .78, 84 / 2 * .78, shade(BODY, 1.2))
    for sx in (-1, 1):
        s.ellipse_wh(sx * 44, 6, 34.4, 18, 18, '#23262b')
        s.ellipse_wh(sx * 44, 6, 34.6, 15, 15, '#30343a')
        s.cyl(sx * 44, 6, 4.2, 34.5, 60, '#595e66')
        s.dome(sx * 44, 6, 58, 68, 13, 13, '#6a7078', n=12, flat=.3, power=2)
    s.rbox(0, 14, 44, 26, 34.4, 36, '#13202c', r=2)
    s.rbox(0, 14, 38, 20, 36, 36.4, '#2a5a7a', r=1)
    for x, y in ((-12, -14), (12, -14), (0, -22), (0, -6)): s.cyl(x, y, 3.2, 34.4, 37.5, '#70767e')
    for x in (-52, -34, 34, 52):
        s.cyl(x, -21, 3, 33.6, 36.5, '#5a6069')
        s.cyl(x, -21, 1.4, 36.5, 48, '#9aa0a8')
        s.ellipse_wh(x, -21, 48.2, 2.2, 2.2, '#d2d6db')
    return s

MODELS = dict(radio=radio, whoop=whoop, pavo=pavo, cinebot=cinebot, five=five, five_b=five_b)
# projected widths of the finished drawings (mm), filled in by render()
SPAN_MM = {}

def draw(s, name):
    _SCENE[0] = s; MODELS[name](s); _SCENE[0] = None; return s

def render(name, yaw=None):
    s = Scene(yaw=yaw); draw(s, name)
    SPAN_MM[name] = s.bbox[2] - s.bbox[0]
    return s.svg()

FLY_YAW = math.radians(-45)     # gate scenes: the drone's nose points screen-right and a little toward the viewer

def streaks(s, span, color, z=14):
    """neon light streaks trailing behind a flying drone (the nose is +y, so they run to -y):
    three tapered ribbons with a blurred glow under them, drawn before the drone"""
    gid = 'streak_%s' % color.lstrip('#')
    if gid not in s._grad:
        s._grad[gid] = gid
        s.defs.append('<linearGradient id="%s" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="%s" stop-opacity=".95"/>'
                      '<stop offset=".45" stop-color="%s" stop-opacity=".45"/><stop offset="1" stop-color="%s" stop-opacity="0"/></linearGradient>' % (gid, color, color, color))
        s.defs.append('<filter id="sglow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>')
    L = span * 1.9
    ribbons = ''
    for k, (ox, w, ln) in enumerate(((-span * .24, span * .09, .8), (0, span * .13, 1.0), (span * .24, span * .09, .85))):
        y0 = -span * .25
        ribbons += '<path d="M%s %sL%s %sL%s %sZ" fill="url(#%s)"/>' % (f2(ox - w / 2), f2(y0), f2(ox + w / 2), f2(y0), f2(ox + (k - 1) * span * .06), f2(y0 - L * ln), gid)
    s.out.append('<g transform="%s" filter="url(#sglow)" opacity=".8">%s</g>' % (s.layer(z), ribbons))
    s.out.append('<g transform="%s" opacity=".9">%s</g>' % (s.layer(z), ribbons))
    s.mark(0, -span * .25 - L, z); s.mark(-span * .5, -span * .25 - L, z); s.mark(span * .5, -span * .25 - L, z)

def fly(model, yaw_deg, color):
    """a drone in flight with its neon streak, no gate"""
    s = Scene(yaw=math.radians(yaw_deg))
    probe = Scene(yaw=s.yaw); draw(probe, model); span = probe.bbox[2] - probe.bbox[0]
    s.off = (0, 0, 30)
    streaks(s, span * .55, color)
    draw(s, model)
    return s.svg(pad=8)

def gate(color, drone, scale=1.0, yaw_deg=-45, neon=None):
    """an FPV race gate (LED tube on two feet) with a drone flying through it"""
    s = Scene(yaw=math.radians(yaw_deg))
    # size the gate to the drone
    probe = Scene(yaw=s.yaw); draw(probe, drone)
    span = (probe.bbox[2] - probe.bbox[0]) * scale
    W = span * 1.25 + 110; H = W * 0.92; r = W * 0.16; t = W * 0.045
    # feet
    for sx in (-1, 1):
        s.box(sx * W / 2 - 12, -22, sx * W / 2 + 12, 22, 0, 5, '#4a4f57')
    # the ring on the vertical plane y = 0
    T = s.face(0, 0, 0, 0, 1)
    rect = '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" ry="%s" fill="none" ' % (f2(-W / 2), f2(5), f2(W), f2(H), f2(r), f2(r))
    glow = 'gl%d' % 1
    s.defs.append('<filter id="%s" x="-20%%" y="-20%%" width="140%%" height="140%%"><feGaussianBlur stdDeviation="%s"/></filter>' % (glow, f2(t * 1.8)))
    s.out.append('<g transform="%s">' % T)
    s.out.append(rect + 'stroke="%s" stroke-opacity=".38" stroke-width="%s" filter="url(#%s)"/>' % (color, f2(t * 2.6), glow))
    s.out.append(rect + 'stroke="#3a3f46" stroke-width="%s"/>' % f2(t))
    s.out.append(rect + 'stroke="%s" stroke-width="%s"/>' % (color, f2(t * .55)))
    s.out.append(rect + 'stroke="#fff" stroke-opacity=".55" stroke-width="%s"/>' % f2(t * .14))
    s.out.append('</g>')
    for sx in (-1, 1):
        s.mark(sx * W / 2 - t, 0, 0); s.mark(sx * W / 2 + t, 0, H + 5 + t)
    # the drone, through the middle, a little forward of the plane
    s.off = (0, 14, 5 + H * 0.40)
    streaks(s, span * .55, neon or color)
    draw(s, drone)
    s.off = (0, 0, 0)
    return s.svg(pad=8)

# the gate scenes: (file, gate colour, drone, yaw deg, streak colour). Different headings on purpose.
GATES = [('gate-1', '#6b4bc4', 'whoop', -45, '#22d3ee'), ('gate-2', '#c4521a', 'pavo', -150, '#f052a0'),
         ('gate-3', '#2f8a4a', 'five', -28, '#38e07a'), ('gate-c', '#c4521a', 'cinebot', -40, '#f0a91a')]
# drones in flight for the open parts of the sheets: (file, model, yaw deg, streak colour)
FLIES = [('fly-five-b', 'five_b', 150, '#7c5cff'), ('fly-whoop', 'whoop', 62, '#22d3ee'), ('fly-pavo', 'pavo', -150, '#f052a0'),
         ('fly-cinebot', 'cinebot', 24, '#f0a91a'), ('fly-cinebot-2', 'cinebot', 118, '#38e07a'), ('fly-five', 'five', 128, '#38e07a')]
PX_PER_MM = 1.15   # one scale for every <img> on the posters, so the fleet grows like the real one

if __name__ == '__main__':
    os.makedirs(IMG, exist_ok=True)
    tiles = []
    for name in MODELS:
        svg = render(name)
        with open(os.path.join(IMG, 'drone-%s.svg' % name), 'w') as f: f.write(svg)
        tiles.append('<figure><img src="img/drone-%s.svg" style="width:%dpx"><figcaption>%s · %.0f mm wide</figcaption></figure>' % (name, int(SPAN_MM[name] * 1.3), name, SPAN_MM[name]))
        print('drone-%s.svg  %5.0f mm wide  %3d KB' % (name, SPAN_MM[name], len(svg) // 1024))
    for fname, col, drone, yaw, neon in GATES:
        svg = gate(col, drone, yaw_deg=yaw, neon=neon)
        with open(os.path.join(IMG, fname + '.svg'), 'w') as f: f.write(svg)
        tiles.append('<figure><img src="img/%s.svg" style="width:%dpx"><figcaption>%s</figcaption></figure>' % (fname, int(SPAN_MM[drone] * 1.55 * 1.3), fname))
        print('%s.svg  %3d KB' % (fname, len(svg) // 1024))
    for fname, model, yaw, neon in FLIES:
        svg = fly(model, yaw, neon)
        with open(os.path.join(IMG, fname + '.svg'), 'w') as f: f.write(svg)
        tiles.append('<figure><img src="img/%s.svg" style="width:%dpx"><figcaption>%s</figcaption></figure>' % (fname, 320, fname))
        print('%s.svg  %3d KB' % (fname, len(svg) // 1024))
    with open(os.path.join(HERE, 'preview-drones.html'), 'w') as f:
        f.write('<!doctype html><meta charset="utf-8"><title>drones</title><style>body{background:#fff;font:14px Barlow,sans-serif;margin:30px;display:flex;flex-wrap:wrap;gap:40px;align-items:flex-end}'
                'figure{margin:0;text-align:center}img{display:block}figcaption{margin-top:8px;color:#555}</style>' + ''.join(tiles))
