/* pilots.js - one pilot per name (2026-10-10).
   The kiosk can end up with two profiles for one person whose names differ
   only by punctuation or case ("Micah T." and "Micah T"). Every page matches
   a pilot by slug, so both rows were "you" and the empty one could sit in
   the wrong tier. mergePilots(data) folds same-slug rows together, in place:
   times and per-sim times add up, badges are united, tier / percentages /
   last-seen take the highest, and the name of the row with the most badges
   (then the most time) is kept. Load before any page script reads data.json. */
(function () {
  function slug(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  var MAX = { tier: 1, gsPct: 1, gsLessons: 1, lastSeen: 1 };
  function weight(p) { return [(p.badges || []).length, p.totalMs || 0]; }
  function merge(a, b) {
    var keep = (weight(b)[0] > weight(a)[0] || (weight(b)[0] === weight(a)[0] && weight(b)[1] > weight(a)[1])) ? b : a;
    var out = {}, k;
    for (k in a) out[k] = a[k];
    for (k in b) {
      var x = out[k], y = b[k];
      if (!(k in out)) out[k] = y;
      else if (k === 'badges') { var u = (x || []).slice(); (y || []).forEach(function (id) { if (u.indexOf(id) < 0) u.push(id); }); out[k] = u; }
      else if (typeof x === 'number' && typeof y === 'number') out[k] = MAX[k] ? Math.max(x, y) : x + y;
      else if (x && y && typeof x === 'object' && !Array.isArray(x)) { var o = {}, j; for (j in x) o[j] = x[j]; for (j in y) o[j] = (typeof o[j] === 'number' && typeof y[j] === 'number') ? o[j] + y[j] : (j in o ? o[j] : y[j]); out[k] = o; }
    }
    out.name = keep.name;
    return out;
  }
  window.mergePilots = function (d) {
    if (!d || !Array.isArray(d.pilots)) return d;
    var by = {}, order = [];
    d.pilots.forEach(function (p) {
      var s = slug(p.name);
      if (!s) { order.push(p); return; }
      if (by[s]) by[s].p = merge(by[s].p, p);
      else { by[s] = { p: p }; order.push(by[s]); }
    });
    d.pilots = order.map(function (x) { return x.p || x; });
    return d;
  };
})();
