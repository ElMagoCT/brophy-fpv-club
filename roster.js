/* roster.js - the club roster: the one list of names (2026-11-26).

   A pilot is one roster entry, { slug, name, aliases, at }. `slug` is the
   pilot's permanent key: it never changes and is never reused. `aliases` are
   other slugs that are the same person (an old name, a merged entry, an old
   file name in the control repo). The list comes from GET /api/roster and is
   kept in localStorage['fpv.roster.v1'] so the next page has it at once.

   If the API cannot be reached (or is not deployed yet) the names in
   data.json stand in, with slug(name) as the key - what the site did before
   there was a roster. Nothing is shown about that; pickers just work.

   The device's identity stays fs.pilot.v1 = { name, slug } with slug = the
   roster key. Everything a page looks up for a pilot (awards, progress,
   submissions, the kiosk row) goes through here so it covers the key AND its
   aliases: two files or two kiosk rows that are one pilot show as one.

   Load after config.js and before site.js (site.js adds both when a page
   did not). Fires `roster:change` on document whenever the list changes. */
(function () {
  var KEY = 'fpv.roster.v1', FOLDED = 'fpv.folded.v1', FRESH = 60 * 1000;
  var src = (document.currentScript && document.currentScript.src) || '';
  var BASE = src.replace(/roster\.js(\?.*)?$/, '');
  var S = { pilots: [], updated: 0, at: 0, source: '', by: {}, loading: null };

  /* the API's slug() rule, cut and all */
  function slug(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48); }
  function api() { return (window.FPV && FPV.API) || ''; }
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var SLUG = /^[a-z0-9-]{1,48}$/;
  function clean(list) {
    var out = [], seen = {};
    (Array.isArray(list) ? list : []).forEach(function (p) {
      if (!p || typeof p.name !== 'string' || !SLUG.test(String(p.slug || '')) || seen[p.slug]) return;
      var name = p.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
      if (name.length < 2) return;
      seen[p.slug] = 1;
      out.push({ slug: p.slug, name: name, at: +p.at || 0,
        aliases: (Array.isArray(p.aliases) ? p.aliases : []).filter(function (a) { return SLUG.test(String(a || '')) && a !== p.slug; }) });
    });
    out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return out;
  }
  function put(list, source, updated) {
    S.pilots = list; S.source = source; S.updated = updated || 0; S.by = {};
    list.forEach(function (p) { S.by[p.slug] = p; });
    list.forEach(function (p) { p.aliases.forEach(function (a) { if (!S.by[a]) S.by[a] = p; }); });
  }
  function emit() { try { document.dispatchEvent(new CustomEvent('roster:change', { detail: { source: S.source } })); } catch (e) {} }

  /* ---------- reading the list ---------- */
  (function boot() {
    var c = lsGet(KEY, null);
    if (c && Array.isArray(c.pilots) && c.pilots.length) { put(clean(c.pilots), 'cache', c.updated); S.at = +c.at || 0; }
  })();

  function fromData() {
    return fetch(BASE + 'data.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
      var rows = (d && d.pilots) || [];
      return clean(rows.map(function (r) { return { slug: SLUG.test(String(r.slug || '')) ? r.slug : slug(r.name), name: r.name, aliases: [], at: 0 }; }));
    });
  }
  /* resolves with the list; never rejects */
  function load(force) {
    if (S.loading) return S.loading;
    if (!force && S.source === 'api' && Date.now() - S.at < FRESH) return Promise.resolve(S.pilots);
    S.loading = fetch(api() + '/api/roster', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok || !Array.isArray(j.pilots)) throw new Error('roster');
        var before = JSON.stringify(S.pilots);
        put(clean(j.pilots), 'api', +j.updated || 0); S.at = Date.now();
        lsSet(KEY, { at: S.at, updated: S.updated, pilots: S.pilots });
        if (JSON.stringify(S.pilots) !== before) emit();
        return S.pilots;
      })
      .catch(function () {
        /* no API: the last list this device saw, else the names in data.json */
        if (S.pilots.length) return S.pilots;
        return fromData().then(function (list) { put(list, 'data', 0); S.at = Date.now(); emit(); return S.pilots; })
          .catch(function () { return S.pilots; });
      })
      .then(function (list) { S.loading = null; return list; });
    return S.loading;
  }

  /* ---------- who is who ---------- */
  function find(s) { return (s && S.by[s]) || null; }
  /* the entry for a pilot, a kiosk row or a bare name */
  function entry(x) {
    if (!x) return null;
    if (typeof x === 'string') return find(slug(x));
    return find(x.slug) || find(slug(x.name));
  }
  /* the one key a pilot or row is filed under on this site */
  function keyOf(x) {
    var e = entry(x);
    if (e) return e.slug;
    if (typeof x === 'string') return slug(x);
    return (x && (x.slug || slug(x.name))) || '';
  }
  /* every slug that may hold this pilot's files: the key first, then aliases */
  function keys(x) {
    var e = entry(x), out = e ? [e.slug].concat(e.aliases) : [];
    var own = typeof x === 'string' ? slug(x) : (x && (x.slug || slug(x.name)));
    if (own && out.indexOf(own) < 0) out.push(own);
    return out;
  }
  /* { name, slug } as the roster has it; unknown pilots pass through */
  function canon(x) {
    if (!x) return null;
    var e = entry(x);
    if (e) return { name: e.name, slug: e.slug };
    var name = String(typeof x === 'string' ? x : x.name || '').trim();
    return name ? { name: name, slug: (typeof x !== 'string' && x.slug) || slug(name) } : null;
  }
  function is(a, b) { var k = keyOf(a); return !!k && k === keyOf(b); }
  function row(data, pilot) {
    if (!pilot || !data || !data.pilots) return null;
    for (var i = 0; i < data.pilots.length; i++) if (is(data.pilots[i], pilot)) return data.pilots[i];
    return null;
  }
  /* a pilot just joined: show them in pickers before the next GET */
  function add(p) {
    var list = S.pilots.filter(function (x) { return x.slug !== p.slug; }).concat(clean([p]));
    put(clean(list), S.source || 'cache', S.updated);
    lsSet(KEY, { at: S.at, updated: S.updated, pilots: S.pilots });
    emit();
  }

  /* ---------- a pilot's files on the API: the key and every alias ---------- */
  function each(path, pilot) {
    return Promise.all(keys(pilot).map(function (k) {
      return fetch(api() + path + encodeURIComponent(k), { cache: 'no-store' }).then(function (r) { return r.json(); });
    }));
  }
  var RANK = { 'not-started': 0, 'in-progress': 1, complete: 2 };
  /* signed decisions: per badge the latest one stands */
  function awards(pilot) {
    return each('/api/award?pilot=', pilot).then(function (all) {
      var out = null;
      all.forEach(function (j) {
        var a = j && j.awards; if (!a) return;
        if (!out) out = { name: a.name, badges: {}, updated: 0 };
        out.updated = Math.max(out.updated, a.updated || 0);
        Object.keys(a.badges || {}).forEach(function (id) {
          var n = a.badges[id], c = out.badges[id];
          if (!c || (n.at || 0) > (c.at || 0) || ((n.at || 0) === (c.at || 0) && n.status === 'earned')) out.badges[id] = n;
        });
      });
      return out;
    });
  }
  /* website progress: forward only, like the API's own merge */
  function progress(pilot) {
    return each('/api/progress?pilot=', pilot).then(function (all) {
      var out = null;
      all.forEach(function (j) {
        var p = j && j.progress; if (!p) return;
        if (!out) out = { name: p.name, lessons: {}, steps: {}, quizzes: {}, updated: 0 };
        out.updated = Math.max(out.updated, p.updated || 0);
        Object.keys(p.lessons || {}).forEach(function (id) {
          var n = p.lessons[id], c = out.lessons[id] || { status: 'not-started', score: 0, at: 0 };
          out.lessons[id] = { status: (RANK[n.status] || 0) > (RANK[c.status] || 0) ? n.status : c.status,
            score: Math.max(c.score || 0, n.score || 0), at: Math.max(c.at || 0, n.at || 0) };
        });
        Object.keys(p.steps || {}).forEach(function (b) {
          out.steps[b] = out.steps[b] || {};
          Object.keys(p.steps[b] || {}).forEach(function (i) { if (p.steps[b][i]) out.steps[b][i] = out.steps[b][i] || p.steps[b][i]; });
        });
        Object.keys(p.quizzes || {}).forEach(function (b) {
          var n = p.quizzes[b], c = out.quizzes[b];
          if (!c || (n.best || 0) > (c.best || 0)) out.quizzes[b] = n;
        });
      });
      return out;
    });
  }
  function submissions(pilot) {
    return each('/api/submission?pilot=', pilot).then(function (all) {
      var out = [], seen = {};
      all.forEach(function (j) { ((j && j.items) || []).forEach(function (it) { if (it && !seen[it.id]) { seen[it.id] = 1; out.push(it); } }); });
      out.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
      return out;
    });
  }

  /* ---------- this device's own stores ----------
     Lessons, bench ticks and "confetti shown" are kept per slug. When a pilot's
     key is not the slug this device used before (an alias), fold the old copy
     into the key once, forward only. The old copy stays where it is. */
  function adopt(pilot) {
    var e = entry(pilot); if (!e) return false;
    var done = lsGet(FOLDED, {}), mine = done[e.slug] || {}, changed = false;
    keys(pilot).forEach(function (k) {
      if (k === e.slug || mine[k]) return;
      var gs = lsGet('gsWeb.profiles.v2', {}), from = gs[k];
      if (from && from.groundSchool) {
        var to = gs[e.slug] || { groundSchool: { lessons: {}, progressPct: 0, updated: 0 }, created: Date.now() };
        to.groundSchool = to.groundSchool || { lessons: {} }; to.groundSchool.lessons = to.groundSchool.lessons || {};
        Object.keys(from.groundSchool.lessons || {}).forEach(function (id) {
          var n = from.groundSchool.lessons[id], c = to.groundSchool.lessons[id];
          if (!c) { to.groundSchool.lessons[id] = JSON.parse(JSON.stringify(n)); return; }
          if ((RANK[n.status] || 0) > (RANK[c.status] || 0)) { c.status = n.status; c.completed = c.completed || n.completed || 0; }
          c.score = Math.max(c.score || 0, n.score || 0);
          c.attempts = Math.max(c.attempts || 0, n.attempts || 0);
          c.timeMs = Math.max(c.timeMs || 0, n.timeMs || 0);
        });
        to.groundSchool.progressPct = Math.max(to.groundSchool.progressPct || 0, from.groundSchool.progressPct || 0);
        gs[e.slug] = to; lsSet('gsWeb.profiles.v2', gs);
      }
      var pr = lsGet('fs.progress.v1', {}), pf = pr[k];
      if (pf) {
        var pt = pr[e.slug] || {};
        Object.keys(pf).forEach(function (b) {
          pt[b] = pt[b] || { steps: {} }; pt[b].steps = pt[b].steps || {};
          Object.keys((pf[b] && pf[b].steps) || {}).forEach(function (i) { if (pf[b].steps[i]) pt[b].steps[i] = true; });
        });
        pr[e.slug] = pt; lsSet('fs.progress.v1', pr);
      }
      ['fs.celebrated.v1', 'cl.celebrated.v1'].forEach(function (name) {
        var all = lsGet(name, {}), f = all[k];
        if (f == null) return;
        if (typeof f === 'object') { var t = all[e.slug] || {}; Object.keys(f).forEach(function (id) { t[id] = t[id] || f[id]; }); all[e.slug] = t; }
        else all[e.slug] = all[e.slug] || f;
        lsSet(name, all);
      });
      mine[k] = Date.now(); changed = true;
    });
    if (changed) { done[e.slug] = mine; lsSet(FOLDED, done); }
    return changed;
  }

  window.Roster = {
    slug: slug, load: load, add: add,
    list: function () { return S.pilots.slice(); },
    ready: function () { return !!S.source; },
    source: function () { return S.source; },
    find: find, entry: entry, keyOf: keyOf, keys: keys, canon: canon, is: is, row: row,
    awards: awards, progress: progress, submissions: submissions, adopt: adopt
  };
})();
