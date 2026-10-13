/* gs-web.js - lets the kiosk's Ground School run on the public website.

   The course app (gs-app.js) talks to the kiosk bridge over three endpoints.
   There is no bridge on the web, so this file answers those three calls from
   localStorage instead. It is loaded BEFORE gs-app.js and changes nothing in
   it: gs-app.js is copied verbatim from C:\BrophyUAV by Publish-GroundSchool.ps1
   and must stay identical to the kiosk's copy.

   Since 2026-10-04 progress is kept PER PILOT: the pilot picked on
   ../flightschool/ (localStorage fs.pilot.v1) owns a profile under
   gsWeb.profiles.v2[slug]. Flight School reads the same store to tick off the
   lessons inside each badge. Nobody picked -> a "Guest" profile on this device.
   The old single profile (gsWebProfile.v1) is migrated into the first pilot
   who signs in here, once, so nobody loses lessons they already did.

   Progress made here lives in THIS browser only. It never reaches the kiosks
   or the leaderboard - the site is one-directional by design (the kiosk
   publishes; nothing flows back). Instructors approve badges in ../admin/. */
(function(){
  var KEY_PILOT = 'fs.pilot.v1', KEY_ALL = 'gsWeb.profiles.v2', KEY_OLD = 'gsWebProfile.v1';
  var API = 'https://brophy-fpv-club-api.netlify.app';   // the club API: progress is mirrored there, monotonically, per pilot name
  var realFetch = window.fetch.bind(window);

  function slug(n){ return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function get(k, d){ try{ var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }
  function set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

  function pilot(){ var p = get(KEY_PILOT, null); return (p && p.name) ? { name:p.name, slug:p.slug || slug(p.name) } : { name:'Guest (this device)', slug:'guest' }; }

  function load(){
    var who = pilot(), all = get(KEY_ALL, {});
    var p = all[who.slug];
    if(!p){
      // one-time migration of the pre-2026-10-04 single profile
      var old = get(KEY_OLD, null);
      if(old && old.groundSchool && who.slug !== 'guest' && !all.__migrated){
        p = old; all.__migrated = true;
        try{ localStorage.removeItem(KEY_OLD); }catch(e){}
      } else {
        p = { groundSchool:{ lessons:{}, progressPct:0, updated:0 }, created:Date.now() };
      }
    }
    p.id = 'web_' + who.slug; p.name = who.name; p.lastSeen = Date.now();
    all[who.slug] = p; set(KEY_ALL, all);
    return p;
  }
  function save(p){ var all = get(KEY_ALL, {}); all[pilot().slug] = p; set(KEY_ALL, all); }
  function reply(obj){
    return Promise.resolve(new Response(JSON.stringify(obj), { status:200, headers:{'Content-Type':'application/json'} }));
  }
  function catalog(){
    var ids = (window.GS_COURSE || []).map(function(l, i){ return { id:l.id, module:l.mod, order:i, title:l.title }; });
    return { passScore:80, lessons:ids };
  }

  /* Mirrors the bridge's /api/groundschool/lesson rules (Start-Kiosk.ps1):
     best score kept, attempts counted on entry to in-progress, time clamped. */
  function lesson(body){
    var p = load();
    var L = p.groundSchool.lessons[body.lessonId] ||
            { status:'not-started', score:0, attempts:0, firstStarted:0, completed:0, timeMs:0 };
    var was = L.status, now = Date.now();
    if(body.status === 'in-progress' && (was === 'not-started' || was === 'complete')) L.attempts++;
    if(was === 'not-started' && body.status !== 'not-started' && !L.firstStarted) L.firstStarted = now;
    if(body.score != null && body.score > L.score) L.score = Math.max(0, Math.min(100, body.score));
    if(body.timeMsDelta > 0) L.timeMs += Math.min(3600000, body.timeMsDelta);
    if(body.status === 'complete' && was !== 'complete') L.completed = now;
    if(body.status === 'not-started'){ L.score = 0; L.completed = 0; }
    L.status = body.status;
    p.groundSchool.lessons[body.lessonId] = L;
    var all = window.GS_COURSE || [], done = 0;
    all.forEach(function(l){ var r = p.groundSchool.lessons[l.id]; if(r && r.status === 'complete') done++; });
    p.groundSchool.progressPct = all.length ? Math.round(done * 100 / all.length) : 0;
    p.groundSchool.updated = now; p.lastSeen = now;
    save(p);
    push(body.lessonId, L);
    return { ok:true, profile:p };
  }

  /* Mirror to the API so the kiosks (and the pilot's other devices) see it.
     Fire-and-forget; the page never waits on it and a failure changes nothing
     locally. Guests are not mirrored - there is no name to file it under. */
  var QUIZ_BADGE = { saf:'safe-flight', bat:'battery-care', elc:'electrical-components', rad:'radio-protocol',
                     evt:'event-ops', spt:'spotter' };   /* asp and emg quizzes retired 2026-10-06; spt added 2026-10-10 */
  function push(lessonId, L){
    var who = pilot(); if(who.slug === 'guest') return;
    var lessons = {}; lessons[lessonId] = { status:L.status, score:L.score };
    var body = { name: who.name, lessons: lessons };
    var m = /^gs-([a-z]{3})-quiz$/.exec(lessonId);
    if(m && QUIZ_BADGE[m[1]] && L.score > 0){ body.quizzes = {}; body.quizzes[QUIZ_BADGE[m[1]]] = { best: L.score }; }
    try{ realFetch(API + '/api/progress', { method:'POST', headers:{'Content-Type':'application/json'}, keepalive:true,
          body: JSON.stringify(body) }).catch(function(){}); }catch(e){}
  }
  /* On load, pull what the API knows for this pilot and merge it in (forward only). */
  function pull(){
    var who = pilot(); if(who.slug === 'guest') return;
    realFetch(API + '/api/progress?pilot=' + encodeURIComponent(who.name), { cache:'no-store' }).then(function(r){ return r.json(); }).then(function(j){
      var srv = j && j.progress; if(!srv || !srv.lessons) return;
      var p = load(), RANK = { 'not-started':0, 'in-progress':1, 'complete':2 }, changed = false;
      Object.keys(srv.lessons).forEach(function(id){
        var S = srv.lessons[id], L = p.groundSchool.lessons[id] || { status:'not-started', score:0, attempts:0, firstStarted:0, completed:0, timeMs:0 };
        if((RANK[S.status] || 0) > (RANK[L.status] || 0)){ L.status = S.status; if(S.status === 'complete' && !L.completed) L.completed = S.at || Date.now(); changed = true; }
        if((S.score || 0) > (L.score || 0)){ L.score = S.score; changed = true; }
        p.groundSchool.lessons[id] = L;
      });
      if(changed){ save(p); }
    }).catch(function(){});
  }
  pull();

  window.fetch = function(url, opts){
    /* gs-app.js prefixes its API constant (the bridge's origin on the kiosk,
       the page origin here); strip anything up to "/api/" and match the path. */
    var u = String(url), k = u.indexOf('/api/');
    if(k < 0) return realFetch(url, opts);
    u = u.slice(k);
    if(u === '/api/active') return reply({ profile: load() });
    if(u === '/api/groundschool/catalog') return reply(catalog());
    /* A badge quiz passed here already showed its confetti in the course;
       note it for Flight School so it does not pop the same badge again on
       this device (2026-10-08). Only if Flight School has already recorded
       this pilot here - its first look records everything quietly. */
    if(u === '/api/badges/celebrated'){
      var cb = {}; try{ cb = JSON.parse(opts && opts.body || '{}'); }catch(e){}
      var who = pilot(), cel = get('fs.celebrated.v1', {});
      if(who.slug !== 'guest' && cel[who.slug]){
        (cb.ids || []).forEach(function(id){ cel[who.slug][String(id)] = Date.now(); });
        set('fs.celebrated.v1', cel);
      }
      return reply({ ok:true });
    }
    if(u === '/api/groundschool/lesson'){
      var b = {}; try{ b = JSON.parse(opts && opts.body || '{}'); }catch(e){}
      return reply(lesson(b));
    }
    return reply({ ok:false });
  };

  /* A thin strip so the pilot can see whose progress this is, and get back to
     Flight School to change it. Injected, not in the kiosk's markup. */
  function strip(){
    var who = pilot(), guest = who.slug === 'guest';
    var d = document.createElement('div');
    d.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;justify-content:center;gap:14px;align-items:center;' +
      'padding:7px 14px;background:#1f3350;color:#f2ece0;font:14px/1.3 Barlow,system-ui,sans-serif;letter-spacing:.02em');
    d.innerHTML = '<span>' + (guest ? 'Progress is saved on this device as <b>Guest</b>.' : 'Lessons save on this device for <b></b>.') + '</span>' +
      '<a href="../pilot-path/" style="color:#f0a91a;font-family:\'Share Tech Mono\',monospace;font-size:13px;letter-spacing:.12em;text-transform:uppercase">' +
      (guest ? 'Pick your pilot \u2192' : 'Flight School \u2192') + '</a>';
    if(!guest) d.querySelector('b').textContent = who.name;
    document.body.appendChild(d);
    document.body.style.paddingBottom = '44px';
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', strip); else strip();
})();
