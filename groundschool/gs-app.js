/* ===========================================================================
   FPV GROUND SCHOOL - APPLICATION
   ---------------------------------------------------------------------------
   Router, syllabus, lesson runner, checkride, and everything that talks to
   the bridge.

   WHAT IT TALKS TO (all of it already existed - no PowerShell was changed)

     GET  /api/active                     who is flying
     GET  /api/groundschool/catalog       what lessons exist, and the pass mark
     POST /api/groundschool/lesson        one lesson's progress

   TWO THINGS TO KNOW BEFORE EDITING

   1. NEVER poll /api/state with ?client=kiosk from here. That query marker is
      what tells the bridge to consume its one-shot showAdmin flag, and if this
      page eats it the bottom bar's ESCAPE button silently stops working. This
      file does not call /api/state at all, which is the safest version of that
      rule.

   2. WRITE AS LITTLE AS POSSIBLE. Every POST to the bridge runs a full
      Save-Store on a single-threaded server that is also hosting the keyboard
      hook. So: one write when a lesson opens, one when it closes. No
      heartbeats, no per-question saves. The lesson clock is kept here in JS
      and banked as a single timeMsDelta on the way out.

   THE CATALOGUE IS THE AUTHORITY on which lessons exist. config.json is read
   once at kiosk startup, so if the catalogue on the wire does not match
   gs-content.js the kiosk has not been restarted since the curriculum
   changed - and every write would come back "unknown lesson". That case is
   detected at boot and said out loud rather than failing quietly.
   =========================================================================== */

var GSApp = (function(){

  var API = '';
  var el  = function(id){ return document.getElementById(id); };
  var h   = GSDrills._h;

  var S = {
    profile:null,
    passScore:80,
    catalogIds:{},
    catalogStale:false,
    lessons:{},          /* lessonId -> record from the profile */
    lesson:null,         /* the open lesson, if any */
    live:null            /* the running drill/widget, so it can be torn down */
  };

  /* ---------------------------------------------------------------- utils */
  function toast(msg){
    var t = el('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function(){ t.classList.remove('show'); }, 2600);
  }

  function api(path, body){
    var opts = { method: body ? 'POST' : 'GET', headers:{'Content-Type':'application/json'} };
    if(body) opts.body = JSON.stringify(body);
    return fetch(API + path, opts).then(function(r){
      if(!r.ok) return r.text().then(function(t){ throw new Error(t || ('HTTP ' + r.status)); });
      return r.json();
    });
  }

  function lessonById(id){
    for(var i=0;i<GS_COURSE.length;i++){ if(GS_COURSE[i].id === id) return GS_COURSE[i]; }
    return null;
  }
  function moduleLessons(code){
    return GS_COURSE.filter(function(l){ return l.mod === code; })
                    .sort(function(a,b){ return (a.ord || 0) - (b.ord || 0); });
  }
  function moduleQuiz(code){
    var q = GS_COURSE.filter(function(l){ return l.mod === code && l.kind === 'quiz'; });
    return q.length ? q[0] : null;
  }
  function rec(id){
    return S.lessons[id] || { status:'not-started', score:0, attempts:0, timeMs:0 };
  }
  function isDone(id){ return rec(id).status === 'complete'; }

  /* how far through the whole course, counted the same way the bridge does */
  function overall(){
    var done = 0;
    GS_COURSE.forEach(function(l){ if(isDone(l.id)) done++; });
    return { done:done, total:GS_COURSE.length,
             pct: GS_COURSE.length ? Math.round(done / GS_COURSE.length * 100) : 0 };
  }

  /* =======================================================================
     THE LESSON CLOCK  -  and the sixth idle clock in this system
     -----------------------------------------------------------------------
     A lesson used to bank wall-clock time: Date.now() minus when it opened.
     So a student who opened a lesson and wandered off banked the whole wander.

     Now the clock only advances while somebody is actually there. After
     GS_IDLE_MS of no input it stops, and it resumes the instant anything is
     touched. Same semantics as the bridge's idleStopMinutes (clock #1 in
     CLAUDE.md): the idle period itself is counted, and everything after it is
     not - "stop after 30 s of inactivity", not "retroactively discard".

     ACTIVITY IS NOT JUST KEYBOARD AND MOUSE. It must include transmitter
     movement, and here that matters more than it does for the bridge. The
     Hover Trainer is forty-five seconds of nothing but stick input; a student
     flying it on a radio touches neither keyboard nor mouse, and a
     keyboard-only check would pause the clock in the middle of the drill and
     tell them their time had stopped. So the gamepad axes are sampled every
     tick and accumulated as travel, exactly the way the bridge does it, with a
     noise floor so that gimbal drift at rest does not read as a person.

     The two stick constants may need tuning against the real transmitter, the
     same caveat config.json carries for joystickTravelThreshold. They are
     deliberately generous: under-recording costs a student credit they earned,
     which is the worse failure of the two.
     ======================================================================= */

  var GS_IDLE_MS     = 30000;   /* stop banking after this much quiet */
  var GS_TICK_MS     = 500;     /* how often the clock is advanced */
  var GS_AXIS_NOISE  = 0.004;   /* per-axis, per-tick movement below this is drift */
  var GS_AXIS_TRAVEL = 0.010;   /* total travel in one tick that counts as a person */

  var lastInput = Date.now();
  var padPrev   = null;
  var clockTimer = 0;

  /* The hangar signs a pilot out after two minutes without input, and input
     inside this frame never reaches its document. So while somebody is active
     here, relay a heartbeat to the parent - at most one every 5 s. Same
     origin only, and harmless when nobody is listening (the website copy is
     not framed, so it never sends one). */
  var lastRelay = 0;
  function markActive(){
    lastInput = Date.now();
    if(lastInput - lastRelay > 5000 && framed()){
      lastRelay = lastInput;
      try{ window.parent.postMessage({ source:'groundschool', action:'activity' }, window.location.origin); }
      catch(e){}
    }
  }

  /* Capture phase, on window: a drill canvas or a button must not be able to
     swallow the signal before it is seen. */
  ['keydown','keyup','mousedown','mousemove','wheel','pointerdown','touchstart']
    .forEach(function(ev){ window.addEventListener(ev, markActive, true); });

  /* Transmitter movement, measured as accumulated travel rather than
     deflection - a student holding a steady hover is making small continuous
     corrections, which travel sees and a "is the stick pushed" test does not. */
  function sampleStick(){
    var ax = GSInput.rawAxes();
    if(!ax){ padPrev = null; return; }
    if(padPrev && padPrev.length === ax.length){
      var travel = 0;
      for(var i=0;i<ax.length;i++){
        var d = Math.abs(ax[i] - padPrev[i]);
        if(d > GS_AXIS_NOISE) travel += d;
      }
      if(travel > GS_AXIS_TRAVEL) markActive();
    }
    padPrev = ax.slice();
  }

  function isIdle(){ return (Date.now() - lastInput) > GS_IDLE_MS; }

  /* Advance the accumulator to now and report whether we are idle.
     Called from the tick and again from elapsed(), so a lesson that finishes
     between ticks still banks its last partial slice.

     Two things this gets right that a naive "add dt if not idle now" does not:

     - It banks only the part of the slice that fell inside the 30 s grace
       after the last input, instead of all-or-nothing on the state at the end
       of the slice.
     - It refuses to trust a slice much longer than one tick. Browsers throttle
       setInterval hard in a hidden or backgrounded document, so a slice can
       arrive minutes wide; we have no evidence anybody was present for that
       stretch, and crediting it would hand back exactly the walked-away time
       this clock exists to stop banking. */
  function advanceClock(){
    var Ls = S.lesson;
    if(!Ls || Ls.done) return false;

    var now = Date.now();
    var MAXSLICE = GS_TICK_MS * 3;
    if(now - Ls.tick > MAXSLICE){
      /* ticks stopped. Credit one tick and treat the rest as absent. */
      Ls.tick = now - GS_TICK_MS;
    }

    var stopsAt = lastInput + GS_IDLE_MS;        /* when banking cuts out */
    var countTo = Math.min(now, stopsAt);
    var add     = countTo - Ls.tick;
    if(add > 0) Ls.activeMs += add;
    Ls.tick = now;
    return now > stopsAt;
  }

  function clockTick(){
    var Ls = S.lesson;
    if(!Ls || Ls.done){ paintPaused(false); return; }
    sampleStick();
    paintPaused(advanceClock());
  }

  function paintPaused(on){
    var tag = el('lPaused');
    if(!tag) return;
    if(on === tag._on) return;          /* don't touch the DOM every 500 ms */
    tag._on = on;
    tag.classList.toggle('on', !!on);
  }

  function startClock(){
    if(clockTimer) return;
    clockTimer = setInterval(clockTick, GS_TICK_MS);
  }

  /* ------------------------------------------------------------ progress */

  /* One write. status is required; score and timeMsDelta are optional.
     Fire-and-forget on the way out (keepalive) so a page that is closing
     still banks its time. */
  function post(lessonId, status, score, timeMsDelta, keepalive){
    if(S.catalogStale && !S.catalogIds[lessonId]){
      /* the bridge would answer 400 "unknown lesson" - do not pretend */
      return Promise.resolve(null);
    }
    var body = { lessonId:lessonId, status:status };
    if(S.profile) body.profileId = S.profile.id;
    if(score != null) body.score = Math.max(0, Math.min(100, Math.round(score)));
    if(timeMsDelta != null && timeMsDelta > 0) body.timeMsDelta = Math.round(timeMsDelta);

    if(keepalive){
      /* the page is going away; fetch with keepalive survives the unload */
      try{
        fetch(API + '/api/groundschool/lesson', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify(body), keepalive:true
        });
      }catch(e){}
      return Promise.resolve(null);
    }

    return api('/api/groundschool/lesson', body).then(function(r){
      if(r && r.profile){ adopt(r.profile); }
      return r;
    }).catch(function(e){
      toast('Progress not saved: ' + e.message);
      return null;
    });
  }

  function adopt(profile){
    S.profile = profile;
    S.lessons = (profile.groundSchool && profile.groundSchool.lessons) || {};
    paintPilot();
  }

  /* ------------------------------------------------------------ pilot bar */
  function paintPilot(){
    var o = overall();
    el('who').textContent = S.profile ? S.profile.name : 'no pilot selected';
    el('who').className = 'who' + (S.profile ? '' : ' none');
    el('meterFill').style.width = o.pct + '%';
    el('meterPct').textContent = o.pct + '%';
    el('lessonsOf').textContent = o.done + ' of ' + o.total + ' lessons';
  }

  /* ============================================================ SYLLABUS */
  function tickSvg(){
    return '<svg viewBox="0 0 16 16"><path d="M2.5 8.6 L6 12 L13.5 4" fill="none" ' +
           'stroke="#f2ece0" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function kindChip(l){
    if(l.kind === 'quiz')  return '<span class="lkind k-quiz">Quiz</span>';
    if(l.kind === 'drill') return '<span class="lkind k-drill">Drill</span>';
    if(l.check)            return '<span class="lkind k-read">Read + check</span>';
    return '<span class="lkind k-read">Read</span>';
  }

  function renderSyllabus(){
    var host = el('syllabus');
    host.innerHTML = '';

    if(S.catalogStale) host.appendChild(staleStrip());

    GS_MODULES.forEach(function(M){
      var ls = moduleLessons(M.code);
      var allDone = ls.length > 0 && ls.every(function(l){ return isDone(l.id); });
      var quiz = moduleQuiz(M.code);
      var isCheck = false;
      var earned = !!quiz && rec(quiz.id).score >= S.passScore;

      var sheet = h('div','sheet' + (allDone ? ' done' : '') + (isCheck ? ' check' : '') +
                               (isCheck && allDone ? ' passed' : ''));

      var head = h('div','sheethead');
      head.appendChild(h('span','mcode', M.badge ? ('TIER ' + M.tier) : 'PREP'));
      head.appendChild(h('h2','', M.name));
      var doneN = ls.filter(function(l){ return isDone(l.id); }).length;
      head.appendChild(h('span','mmins', doneN + '/' + ls.length + ' · ' + M.mins + ' min'));
      sheet.appendChild(head);
      sheet.appendChild(h('div','sheetsub', M.blurb));
      sheet.appendChild(h('div','sheetrule'));

      ls.forEach(function(l){
        var r = rec(l.id);
        var can = !!S.profile;
        var row = h('button','lrow st-' + r.status + (can ? ' can' : ' no'));
        var tick = h('span','tick', r.status === 'complete' ? tickSvg() : '');
        row.appendChild(tick);
        row.appendChild(h('span','ltitle', l.title));
        row.appendChild(h('span','', kindChip(l)));
        row.appendChild(h('span','lmin', l.mins + 'm'));
        var sc = (r.status === 'complete' || r.score > 0)
          ? h('span','lscore' + (r.score >= 80 ? '' : ' low'), String(Math.round(r.score)))
          : h('span','lscore none','—');
        row.appendChild(sc);
        row.onclick = function(){
          if(!S.profile){ el('gate').classList.add('show'); return; }
          openLesson(l.id);
        };
        sheet.appendChild(row);
      });

      if(earned){
        var seal = h('div','passseal','BADGE EARNED<small>quiz ' + Math.round(rec(quiz.id).score) + ' / 100</small>');
        sheet.appendChild(seal);
      }

      host.appendChild(sheet);
    });
  }

  function staleStrip(){
    var d = h('div','sheet');
    d.style.gridColumn = '1 / -1';
    d.style.borderColor = 'var(--amber)';
    d.style.background = 'rgba(125,88,16,.10)';
    d.innerHTML =
      '<div class="sheethead"><span class="mcode" style="color:var(--amber);border-color:var(--amber)">!</span>' +
      '<h2>Progress is not being saved</h2></div>' +
      '<div class="sheetsub">The kiosk is still serving the old lesson list, so it rejects every one of these ' +
      'lesson ids. Everything here still works and every drill still runs - nothing will be recorded against ' +
      'your name until the kiosk is restarted once. Tell whoever runs the lab.</div>';
    return d;
  }

  /* ============================================================== LESSON */

  function openLesson(id){
    var L = lessonById(id);
    if(!L) return;

    S.lesson = {
      def:L,
      steps:buildSteps(L),
      i:0,
      activeMs:0,           /* banked time - advances only while somebody is here */
      tick:Date.now(),      /* when the clock was last advanced */
      score:null,
      done:false
    };
    /* opening a lesson IS a click, so start the clock un-paused */
    markActive();
    paintPaused(false);
    startClock();

    el('syllabusWrap').classList.add('off');
    el('lesson').classList.add('on');
    el('lCode').textContent = L.id.toUpperCase();
    el('lTitle').textContent = L.title;

    post(id, 'in-progress');
    drawStep();
  }

  function buildSteps(L){
    var steps = [];
    (L.cards || []).forEach(function(c){ steps.push({ t:'card', card:c }); });
    if(L.extra)          steps.push({ t:'widget', w:L.extra });
    if(L.check)          steps.push({ t:'check' });
    if(L.kind === 'drill') steps.push({ t:'drill' });
    if(L.kind === 'quiz')  steps.push({ t:'quiz' });
    if(steps.length && !L.check && L.kind === 'read') steps.push({ t:'end' });
    return steps;
  }

  /* ---------------------------------------------------------------- tabs */

  /* A tab label. Cards carry an optional short `tab` in gs-content.js; without
     one the heading is trimmed at a word boundary, because most headings are
     already short enough to read in a tab. */
  function shortLabel(s){
    s = String(s || '').replace(/[.,:;!?]+$/, '');
    if(s.length <= 24) return s;
    var cut = s.slice(0, 24), sp = cut.lastIndexOf(' ');
    if(sp > 12) cut = cut.slice(0, sp);
    return cut + '…';
  }

  function tabLabel(step){
    if(step.t === 'card')   return step.card.tab || shortLabel(step.card.h);
    if(step.t === 'widget') return 'Try it';
    if(step.t === 'check')  return 'Check';
    if(step.t === 'drill')  return 'Drill';
    if(step.t === 'quiz')   return (S.lesson && S.lesson.def && S.lesson.def.pool) ? 'Badge quiz' : 'Checkride';
    if(step.t === 'end')    return 'Done';
    return '';
  }

  function drawTabs(){
    var Ls = S.lesson, host = el('lTabs');
    if(!Ls || !host) return;
    host.innerHTML = '';
    Ls.steps.forEach(function(s, i){
      var b = h('button', 'ltab' + (i === Ls.i ? ' now' : (i < Ls.i ? ' done' : '')));
      b.appendChild(h('span','tn', String(i + 1)));
      b.appendChild(h('span','tl', tabLabel(s)));
      b.title = tabLabel(s);
      b.onclick = function(){
        if(i === Ls.i) return;
        Ls.i = i;
        drawStep();               /* killLive() first thing in there, so a drill
                                     or widget being jumped away from is torn
                                     down rather than left running */
      };
      host.appendChild(b);
    });
    /* keep the active tab in view when a lesson has more tabs than fit */
    var now = host.querySelector('.ltab.now');
    if(now && now.scrollIntoView){
      try{ now.scrollIntoView({ block:'nearest', inline:'nearest' }); }catch(e){}
    }
  }

  function killLive(){
    if(S.live && S.live.stop){ try{ S.live.stop(); }catch(e){} }
    S.live = null;
  }

  function drawStep(){
    killLive();
    var Ls = S.lesson, L = Ls.def, step = Ls.steps[Ls.i];
    var body = el('lBody');
    body.innerHTML = '';

    drawTabs();

    /* footer defaults - each branch overrides what it needs */
    el('lPrev').style.display = Ls.i > 0 ? '' : 'none';
    el('lNext').style.display = '';
    el('lNext').textContent = (Ls.i === Ls.steps.length - 1) ? 'Finish' : 'Next  →';
    el('lHint').textContent = '';

    if(step.t === 'card')   return drawCard(body, step.card);
    if(step.t === 'widget') return drawWidget(body, step.w);
    if(step.t === 'end')    return drawEnd(body);
    if(step.t === 'check')  return drawCheck(body);
    if(step.t === 'drill')  return drawDrill(body);
    if(step.t === 'quiz')   return drawQuiz(body);
  }

  /* -----------------------------------------------------------------------
     CARD RENDERER - 2026-08-21 overhaul.
     A card is no longer only heading + paragraphs + art. All fields optional,
     all old cards still render:

       h, tab, p[], art, cap, note      as before
       facts: [{n,l,c}]                 key-fact chips  (c: green|rust|amber|sky)
       steps: [{n,t,d}]                 numbered step strip (n defaults to index)
       cols:  {tone,ha,hb,a[],b[]}      two-column board. tone 'dd' = DO/DON'T
                                        (ha/hb default), 'vs' = neutral compare
       tip:   'text'                    PRO TIP callout
       videos:[{yt,t,by,len,alt,cap}]   click-to-load YouTube embeds. NOTHING
                                        loads until tapped - the poster is
                                        local. alt:true = compact deep-dive row
     ----------------------------------------------------------------------- */

  function tipSvg(){
    return '<svg viewBox="0 0 30 30"><circle cx="15" cy="12" r="8" fill="none" ' +
      'stroke="var(--gold)" stroke-width="2"/><path d="M11.5 19 L18.5 19 M12.5 23 L17.5 23 ' +
      'M13.5 26.5 L16.5 26.5" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M15 1.5 L15 4.5 M4.5 12 L1.5 12 M28.5 12 L25.5 12 M7 4 L9 6 M23 4 L21 6" ' +
      'stroke="var(--gold)" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }

  function playSvg(){
    return '<svg viewBox="0 0 74 74"><circle cx="37" cy="37" r="33" fill="var(--glass-3)" ' +
      'stroke="var(--rust)" stroke-width="3"/><circle cx="37" cy="37" r="33" fill="none" ' +
      'stroke="rgba(31,51,80,.25)" stroke-width="1" stroke-dasharray="4 4" transform="rotate(8 37 37)"/>' +
      '<path d="M30 24 L54 37 L30 50 Z" fill="var(--rust)"/></svg>';
  }

  function factRow(facts){
    var row = h('div','kfacts');
    facts.forEach(function(f){
      var kf = h('div','kf' + (f.c ? ' c-' + f.c : ''));
      kf.appendChild(h('span','kn', f.n));
      kf.appendChild(h('span','kl', f.l));
      row.appendChild(kf);
    });
    return row;
  }

  function stepStrip(steps){
    var row = h('div','stepflow');
    steps.forEach(function(s, i){
      var sf = h('div','sf');
      sf.appendChild(h('span','sfn', String(s.n != null ? s.n : i + 1)));
      if(s.t) sf.appendChild(h('span','sft', s.t));
      if(s.d) sf.appendChild(h('span','sfd', s.d));
      row.appendChild(sf);
    });
    return row;
  }

  function colBoard(c){
    var vs = c.tone === 'vs';
    /* 2026-10-10: a 'vs' board pairs its rows (You may / Only once,
       Recreational / Part 107), so it is a real table - a long line on one
       side used to push the other side's rows out of line. */
    if(vs) return colTable(c);
    var row = h('div','board2');
    var a = h('div','b2 ' + (vs ? 'va' : 'ok'));
    a.appendChild(h('div','b2h', c.ha || 'Do'));
    var ul = h('ul');
    (c.a || []).forEach(function(t){ ul.appendChild(h('li','', t)); });
    a.appendChild(ul);
    var b = h('div','b2 ' + (vs ? 'vb' : 'no'));
    b.appendChild(h('div','b2h', c.hb || "Don't"));
    var ul2 = h('ul');
    (c.b || []).forEach(function(t){ ul2.appendChild(h('li','', t)); });
    b.appendChild(ul2);
    row.appendChild(a); row.appendChild(b);
    return row;
  }

  function colTable(c){
    var t = h('table','vstable'), a = c.a || [], b = c.b || [];
    var hr = h('tr');
    hr.appendChild(h('th','va', c.ha || '')); hr.appendChild(h('th','vb', c.hb || ''));
    t.appendChild(hr);
    for(var i = 0; i < Math.max(a.length, b.length); i++){
      var r = h('tr');
      r.appendChild(h('td','', a[i] || '')); r.appendChild(h('td','', b[i] || ''));
      t.appendChild(r);
    }
    return t;
  }

  /* exceptions: a bulleted box under the rule they bend (2026-10-10) */
  function exceptBox(list){
    var box = h('div','exceptions');
    box.appendChild(h('div','exh','Exceptions'));
    var ul = h('ul');
    list.forEach(function(t){ ul.appendChild(h('li','', t)); });
    box.appendChild(ul);
    return box;
  }

  /* Sketch labels are drawn in the handwriting face, which runs wider than
     the art was laid out for - some lines ran off the edge and were cut off.
     After the fonts load, any label that would leave the viewBox is shrunk
     until it fits (2026-10-10). */
  function fitArt(root){
    var svg = root && root.querySelector('svg');
    if(!svg || !svg.viewBox || !svg.viewBox.baseVal || !svg.viewBox.baseVal.width) return;
    function run(){
      var vb = svg.viewBox.baseVal, lo = vb.x + 2, hi = vb.x + vb.width - 2, S = svg.getCTM();
      if(!S) return;
      var inv = S.inverse();
      [].forEach.call(svg.querySelectorAll('text'), function(t){
        var b, m;
        try{ b = t.getBBox(); m = t.getCTM(); }catch(e){ return; }
        if(!b || !b.width || !m) return;
        var M = inv.multiply(m), x1 = M.a * b.x + M.e, x2 = M.a * (b.x + b.width) + M.e, w = x2 - x1;
        if(x1 >= lo && x2 <= hi) return;
        var anchor = window.getComputedStyle(t).textAnchor, avail;
        if(anchor === 'middle'){ var cx = (x1 + x2) / 2; avail = 2 * Math.min(cx - lo, hi - cx); }
        else if(anchor === 'end') avail = x2 - lo;
        else avail = hi - x1;
        if(avail <= 0) return;
        var fs = parseFloat(window.getComputedStyle(t).fontSize) || 12;
        t.style.fontSize = (fs * Math.min(1, avail / w) * 0.97).toFixed(2) + 'px';
      });
    }
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(run); else setTimeout(run, 300);
  }

  function tipBox(text){
    var t = h('div','tipbox');
    t.appendChild(h('span','tico', tipSvg()));
    var b = h('div','tbody');
    b.appendChild(h('span','tlab','Pro tip'));
    b.appendChild(h('div','ttext', text));
    t.appendChild(b);
    return t;
  }

  /* One video. The poster is built locally - no request of any kind until the
     student taps it. Then, and only then, a youtube-nocookie iframe is created.
     Do NOT set referrerpolicy on it: no-referrer is Error 153 (see CLAUDE.md,
     the reel). If the network filters YouTube, the player errors inside the
     box and the caption has already said the video needs the internet. */
  function videoBox(v){
    var wrap = h('div','vidwrap' + (v.alt ? ' alt' : ''));
    var box  = h('div','vidbox');
    var po   = h('button','vposter');
    po.appendChild(h('span','vplay', playSvg()));
    po.appendChild(h('span','vtitle', v.t));
    po.appendChild(h('span','vmeta',
      (v.by ? v.by + ' · ' : '') + (v.len ? v.len + ' · ' : '') + 'YouTube'));
    po.appendChild(h('span','vhint','tap to play — needs the internet'));
    po.onclick = function(){
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + v.yt + '?autoplay=1&rel=0';
      f.allow = 'autoplay; encrypted-media; fullscreen';
      f.setAttribute('allowfullscreen','');
      f.title = v.t;
      box.classList.add('playing');
      box.innerHTML = '';
      box.appendChild(f);
    };
    box.appendChild(po);
    wrap.appendChild(box);
    if(v.cap) wrap.appendChild(h('div','vcap', v.cap));
    return wrap;
  }

  function drawCard(body, c){
    var card = h('div','rcard' + (c.art ? '' : ' noart'));
    var col = h('div','rmain');
    col.appendChild(h('h3','', c.h));
    (c.p || []).forEach(function(par){ col.appendChild(h('p','', par)); });
    if(c.facts) col.appendChild(factRow(c.facts));
    if(c.steps) col.appendChild(stepStrip(c.steps));
    if(c.cols)  col.appendChild(colBoard(c.cols));
    if(c.exceptions) col.appendChild(exceptBox(c.exceptions));
    if(c.tip)   col.appendChild(tipBox(c.tip));
    if(c.note)  col.appendChild(h('div','marginnote', c.note));
    (c.videos || []).forEach(function(v){ col.appendChild(videoBox(v)); });
    card.appendChild(col);
    if(c.art && GS_ART[c.art]){
      var art = h('div','art', GS_ART[c.art]);
      if(c.cap) art.appendChild(h('div','cap', c.cap));
      card.appendChild(art);
    }
    body.appendChild(card);
    fitArt(card);
    el('lHint').textContent = (c.videos && c.videos.length) ? 'Watch' : 'Reading';
  }

  function drawWidget(body, name){
    /* the widget sits on the same white sheet as everything else now */
    var sheet = h('div','rmain');
    sheet.style.cssText = 'max-width:min(1080px,88vw);width:100%;margin:auto';
    body.appendChild(sheet);
    body = sheet;
    var head = h('div','');
    head.style.cssText = 'max-width:760px;margin:0 auto 20px;text-align:center';
    var titles = {
      voltage:['Try it', 'Drag the slider, then punch the throttle. Watch what sag does and does not mean.'],
      signal: ['Try it', 'One slider, two goggle feeds. Take it down slowly and watch how differently they fail.'],
      patch:  ['Try it', 'The aircraft is flying a lap. Aim the patch and watch the link follow.']
    };
    var tt = titles[name] || ['Try it',''];
    head.appendChild(h('h3','', tt[0]));
    el('lHint').textContent = 'Interactive';
    var p = h('p','', tt[1]);
    p.style.cssText = 'font-weight:400;font-size:17px;line-height:1.5;color:var(--ink);margin-top:6px';
    head.appendChild(p);
    head.querySelector('h3').style.cssText =
      'font-family:var(--font-sketch);font-size:32px;font-weight:700;line-height:1';
    body.appendChild(head);
    if(GSWidgets[name]) S.live = GSWidgets[name](body);
  }

  function drawEnd(body){
    var o = h('div','scorecard');
    o.appendChild(h('div','bigscore pass','✓'));
    o.appendChild(h('div','verdict pass','Lesson read'));
    var p = h('p','','Nothing to score here - reading lessons complete when you reach the end. Next time you open the syllabus this one will be ticked off.');
    p.style.cssText = 'margin-top:16px;font-weight:400;font-size:17px;line-height:1.55;color:var(--ink)';
    o.appendChild(p);
    body.appendChild(o);
    el('lNext').textContent = 'Mark it done  →';
    el('lHint').textContent = 'End of lesson';
  }

  /* ---- the 3-question check on a reading lesson ---- */
  function drawCheck(body){
    var L = S.lesson.def, qs = shuffleOpts(GSPanels._shuffle(L.check)), qi = 0, right = 0;
    el('lNext').style.display = 'none';
    el('lPrev').style.display = 'none';
    el('lHint').textContent = 'Quick check';

    function draw(){
      body.innerHTML = '';
      var q = qs[qi];
      var wrap = h('div','qwrap');
      wrap.appendChild(h('div','qhead','CHECK ' + (qi+1) + ' OF ' + qs.length));
      wrap.appendChild(h('div','qtext', q.q));
      var opts = h('div','opts');
      q.opts.forEach(function(o,i){
        var b = h('button','opt');
        b.appendChild(h('span','key', String.fromCharCode(65+i)));
        b.appendChild(h('span','', o));
        b.onclick = function(){ answer(i, opts, q, wrap); };
        opts.appendChild(b);
      });
      wrap.appendChild(opts);
      body.appendChild(wrap);
    }

    function answer(i, opts, q, wrap){
      var ok = (i === q.a);
      if(ok) right++;
      var kids = opts.children;
      for(var k=0;k<kids.length;k++){
        kids[k].disabled = true;
        if(k === q.a)      kids[k].className = 'opt right';
        else if(k === i)   kids[k].className = 'opt wrong';
        else               kids[k].className = 'opt dim';
      }
      wrap.appendChild(h('div','why' + (ok ? ' ok' : ''),
        '<b>' + (ok ? 'Correct' : 'Not quite') + '</b>' + q.why));
      var nx = h('div','');
      nx.style.cssText = 'display:flex;justify-content:center;margin-top:20px';
      var b = h('button','minibtn big go', qi === qs.length-1 ? 'See result' : 'Next question');
      b.onclick = function(){ qi++; if(qi >= qs.length) finishCheck(); else draw(); };
      nx.appendChild(b);
      wrap.appendChild(nx);
      b.focus();
    }

    function finishCheck(){
      var score = Math.round(right / qs.length * 100);
      body.innerHTML = '';
      var card = h('div','scorecard');
      card.appendChild(h('div','bigscore ' + (score >= 67 ? 'pass' : 'fail'), String(score)));
      card.appendChild(h('div','verdict ' + (score >= 67 ? 'pass' : 'fail'),
        right + ' of ' + qs.length + ' right'));
      var p = h('p','', score >= 67
        ? 'Good. That is the lesson banked.'
        : 'Worth another look - the answers above explain each one. You can retake this as many times as you like and only your best score is kept.');
      p.style.cssText = 'margin-top:16px;font-weight:400;font-size:17px;line-height:1.55;color:var(--ink)';
      card.appendChild(p);
      var bs = h('div','');
      bs.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:22px;flex-wrap:wrap';
      var f = h('button','minibtn big go','Save and close');
      f.onclick = function(){ complete(score); };
      var r = h('button','minibtn big','Retake the check');
      r.onclick = function(){ qs = shuffleOpts(GSPanels._shuffle(L.check)); qi = 0; right = 0; draw(); };
      bs.appendChild(f); bs.appendChild(r);
      card.appendChild(bs);
      body.appendChild(card);
    }

    draw();
  }

  /* ---- a drill takes the whole body and its own buttons ---- */
  function drawDrill(body){
    var L = S.lesson.def;
    /* A drill owns the footer: it finishes itself, so Next would be a way to
       skip it. Back stays available so the student can re-read the cards. */
    el('lNext').style.display = 'none';
    el('lPrev').style.display = S.lesson.steps.length > 1 ? '' : 'none';
    el('lHint').textContent = 'Drill';

    var runner = GSDrills[L.drill] || GSPanels[L.drill];
    if(!runner){
      body.appendChild(h('div','why','<b>Not built</b> This drill is missing: ' + L.drill));
      return;
    }
    var ctx = {
      lesson:L,
      hint:function(t){ el('lHint').textContent = t; },
      finish:function(score, extra){ complete(score, extra); }
    };
    S.live = runner(body, ctx);
  }

  /* Answer order is reshuffled on every attempt too (2026-10-10), on top of
     the question order, so "it's always B" stops working. Copies - the
     content in gs-content.js is never changed. */
  function shuffleOpts(list){
    return (list || []).map(function(q){
      var idx = q.opts.map(function(_, i){ return i; });
      for(var i = idx.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)), t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
      var c = {}; for(var k in q) c[k] = q[k];
      c.opts = idx.map(function(i){ return q.opts[i]; });
      c.a = idx.indexOf(q.a);
      return c;
    });
  }

  /* ============================================================ CHECKRIDE */
  function drawQuiz(body){
    el('lNext').style.display = 'none';
    el('lPrev').style.display = 'none';
    /* A badge quiz (lesson.pool set) is ten questions from one pool, scored
       out of 100 with no live drills. The old checkride shape (16 questions
       + hover + orientation) is kept for any quiz lesson without a pool. */
    var POOL = S.lesson && S.lesson.def && S.lesson.def.pool;
    el('lHint').textContent = POOL ? S.lesson.def.title : 'Checkride';

    var Q_N = POOL ? 10 : 16, Q_PTS = POOL ? 100 : 80, HOVER_PTS = POOL ? 0 : 10, ORIENT_PTS = POOL ? 0 : 10;

    /* Weighted draw: three from each module, then fill at random from the
       whole pool. Guarantees no module can be skipped by luck. */
    function drawQuestions(){
      if(POOL){
        var pool = GSPanels._shuffle(GS_QUIZ.filter(function(q){ return q.mod === POOL; }));
        return pool.slice(0, Math.min(Q_N, pool.length));
      }
      var byMod = {};
      GS_QUIZ.forEach(function(q){ (byMod[q.mod] = byMod[q.mod] || []).push(q); });
      var out = [];
      ['M1','M2','M3','M4','M5'].forEach(function(m){
        out = out.concat(GSPanels._shuffle(byMod[m] || []).slice(0,3));
      });
      var rest = GSPanels._shuffle(GS_QUIZ.filter(function(q){ return out.indexOf(q) < 0; }));
      while(out.length < Q_N && rest.length) out.push(rest.pop());
      return GSPanels._shuffle(out).slice(0, Q_N);
    }

    var qs = shuffleOpts(drawQuestions()), qi = 0, right = 0, marks = [];
    var hoverScore = 0, orientScore = 0;

    function head(){
      var bar = h('div','');
      bar.style.cssText = 'display:flex;align-items:center;gap:18px;max-width:760px;margin:0 auto 20px;flex-wrap:wrap';
      var prog = h('div','qprog');
      qs.forEach(function(_,i){
        prog.appendChild(h('i', marks[i] === 1 ? 'ok' : (marks[i] === 0 ? 'no' : (i === qi ? 'now' : ''))));
      });
      bar.appendChild(prog);
      var sc = h('span','');
      sc.style.cssText = 'font-family:var(--font-mono);font-size:13px;color:var(--ink-soft);letter-spacing:1.4px';
      sc.textContent = right + ' right · ' + (qs.length - qi) + ' to go';
      bar.appendChild(sc);
      return bar;
    }

    function drawQ(){
      body.innerHTML = '';
      body.appendChild(head());
      var q = qs[qi];
      var wrap = h('div','qwrap');
      wrap.appendChild(h('div','qhead','QUESTION ' + (qi+1) + ' OF ' + qs.length + ' · ' + q.mod));
      wrap.appendChild(h('div','qtext', q.q));
      var opts = h('div','opts');
      q.opts.forEach(function(o,i){
        var b = h('button','opt');
        b.appendChild(h('span','key', String.fromCharCode(65+i)));
        b.appendChild(h('span','', o));
        b.onclick = function(){ ansQ(i, opts, q, wrap); };
        opts.appendChild(b);
      });
      wrap.appendChild(opts);
      body.appendChild(wrap);
    }

    function ansQ(i, opts, q, wrap){
      var ok = (i === q.a);
      marks[qi] = ok ? 1 : 0;
      if(ok) right++;
      var kids = opts.children;
      for(var k=0;k<kids.length;k++){
        kids[k].disabled = true;
        if(k === q.a)    kids[k].className = 'opt right';
        else if(k === i) kids[k].className = 'opt wrong';
        else             kids[k].className = 'opt dim';
      }
      wrap.appendChild(h('div','why' + (ok ? ' ok' : ''),
        '<b>' + (ok ? 'Correct' : 'The answer is ' + String.fromCharCode(65+q.a)) + '</b>' + q.why));
      var nx = h('div','');
      nx.style.cssText = 'display:flex;justify-content:center;margin-top:20px';
      var b = h('button','minibtn big go', qi === qs.length-1 ? (POOL ? 'See your score' : 'On to the flying') : 'Next question');
      b.onclick = function(){ qi++; if(qi >= qs.length){ if(POOL) result(); else startHover(); } else drawQ(); };
      nx.appendChild(b);
      wrap.appendChild(nx);
      b.focus();
    }

    /* ---- the two live drills, cut down ---- */
    function startHover(){
      body.innerHTML = '';
      var lead = h('div','');
      lead.style.cssText = 'max-width:760px;margin:0 auto 18px;text-align:center';
      lead.innerHTML = '<h3 style="font-family:var(--font-sketch);font-size:32px;font-weight:700;line-height:1">' +
        'Part two: hold a hover</h3>' +
        '<p style="font-weight:400;font-size:17px;line-height:1.5;color:var(--ink);margin-top:6px">' +
        'Twenty seconds in the box, with the wind on. Worth ten points.</p>';
      body.appendChild(lead);
      killLive();
      S.live = GSDrills.hover(body, {
        lesson:S.lesson.def,
        hint:function(t){ el('lHint').textContent = t; },
        finish:function(score){ hoverScore = score; startOrient(); }
      }, {
        secs:20,
        levels:[{ n:1, wind:0.85, rate:false, xbox:true,
                  brief:'Twenty seconds. Hold the box - the wind is on.' }]
      });
    }

    function startOrient(){
      body.innerHTML = '';
      var lead = h('div','');
      lead.style.cssText = 'max-width:760px;margin:0 auto 18px;text-align:center';
      lead.innerHTML = '<h3 style="font-family:var(--font-sketch);font-size:32px;font-weight:700;line-height:1">' +
        'Part three: orientation</h3>' +
        '<p style="font-weight:400;font-size:17px;line-height:1.5;color:var(--ink);margin-top:6px">' +
        'Five rounds. Which way do you push? Worth ten points.</p>';
      body.appendChild(lead);
      killLive();
      S.live = GSDrills.orient(body, {
        lesson:S.lesson.def,
        hint:function(t){ el('lHint').textContent = t; },
        finish:function(score){ orientScore = score; result(); }
      }, { rounds:5 });
    }

    function result(){
      killLive();
      var qPts = Math.round(right / qs.length * Q_PTS);
      var hPts = Math.round(hoverScore / 100 * HOVER_PTS);
      var oPts = Math.round(orientScore / 100 * ORIENT_PTS);
      var total = qPts + hPts + oPts;
      var passed = total >= S.passScore;
      /* First pass of a badge quiz: confetti here, and tell the bridge the
         badge has been celebrated so the dash (on this kiosk or the other one)
         does not pop it up again. On the website gs-web.js answers that call
         from this device's storage. 2026-10-08. */
      /* signoff modules (Spotter, Event Ops - 2026-10-10): the quiz is half the
         badge; a mentor signs the rest off, so no badge celebration here. */
      var MOD = null;
      GS_MODULES.forEach(function(M){ if(M.code === S.lesson.def.mod) MOD = M; });
      var SIGNOFF = !!(MOD && MOD.signoff);
      if(POOL && passed && (rec(S.lesson.def.id).score || 0) < S.passScore){
        var bid = (MOD && MOD.badge && !SIGNOFF) ? MOD.badge : null;
        try{ if(window.FPVConfetti) FPVConfetti.burst(); }catch(e){}
        if(bid){
          try{ fetch(API + '/api/badges/celebrated', { method:'POST', headers:{'Content-Type':'application/json'},
                 body: JSON.stringify({ ids:[bid] }) }).catch(function(){}); }catch(e){}
        }
      }

      body.innerHTML = '';
      var card = h('div','scorecard');
      card.appendChild(h('div','bigscore ' + (passed ? 'pass' : 'fail'), String(total)));
      card.appendChild(h('div','verdict ' + (passed ? 'pass' : 'fail'),
        passed ? (POOL ? (SIGNOFF ? 'Quiz passed' : 'Badge earned') : 'Ground school passed') : 'Not yet — ' + S.passScore + ' to pass'));

      var tab = h('table','rtab');
      tab.innerHTML =
        '<tr><td class="k">Questions</td><td class="v">' + right + ' / ' + qs.length + '</td><td class="v">' + qPts + ' / ' + Q_PTS + '</td></tr>' +
        (POOL ? '' :
        '<tr><td class="k">Hover hold</td><td class="v">' + hoverScore + '%</td><td class="v">' + hPts + ' / ' + HOVER_PTS + '</td></tr>' +
        '<tr><td class="k">Orientation</td><td class="v">' + orientScore + '%</td><td class="v">' + oPts + ' / ' + ORIENT_PTS + '</td></tr>');
      card.appendChild(tab);

      var p = h('p','', passed
        ? (POOL ? (SIGNOFF ? 'Quiz passed. The other half of this badge is a mentor watching you do it for real - ask one, and they sign it off.' : 'That badge is yours - no sign-off needed. Best score is kept, so a retake can only help.')
                : 'That mark goes on your record and shows on the hangar leaderboard. Best score is kept, so a retake can only help.')
        : 'The questions reshuffle every attempt, so go back through whichever module let you down and come again. Only your best score is kept — a retake cannot cost you anything.');
      p.style.cssText = 'margin-top:20px;font-weight:400;font-size:17px;line-height:1.55;color:var(--ink)';
      card.appendChild(p);

      var bs = h('div','');
      bs.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:24px;flex-wrap:wrap';
      var f = h('button','minibtn big go','Save and close');
      /* A failed checkride is recorded as in-progress, not complete. The mark
         is still saved (the bridge keeps the best ever), but the lesson does
         not tick off and it does not count toward the course percentage. */
      f.onclick = function(){ passed ? complete(total) : bank(total); };
      bs.appendChild(f);
      if(!passed){
        var r = h('button','minibtn big','Take it again now');
        r.onclick = function(){
          qs = shuffleOpts(drawQuestions()); qi = 0; right = 0; marks = [];
          hoverScore = 0; orientScore = 0; drawQ();
        };
        bs.appendChild(r);
      }
      card.appendChild(bs);
      body.appendChild(card);
    }

    drawQ();
  }

  /* ------------------------------------------------------ finish a lesson */
  /* Active time only - see THE LESSON CLOCK above. */
  function elapsed(){
    var Ls = S.lesson;
    if(!Ls) return 0;
    advanceClock();                 /* bank the slice since the last tick */
    /* clamp: the bridge clamps a single delta to an hour anyway */
    return Math.min(3600000, Math.max(0, Ls.activeMs));
  }

  /* `extra` is the per-drill detail a drill produces - bestLevel, contacts,
     panicInputs and so on. It is shown to the student on the results card but
     it is NOT persisted, because POST /api/groundschool/lesson only accepts
     status, score and timeMsDelta. A lesson record does preserve unknown
     fields once they are on disk (ConvertTo-LessonRecord, Start-Kiosk.ps1:671)
     but there is no way for a client to introduce one. Storing this would take
     roughly fifteen lines in that handler: accept a `detail` object and merge
     it into $L. Deliberately not done here - it means touching the bridge, and
     status/score/attempts/timeMs already covers per-profile tracking. */
  function complete(score, extra){
    var Ls = S.lesson;
    if(!Ls || Ls.done) return;
    Ls.done = true;
    var id = Ls.def.id;
    /* elapsed() first (it needs the clock), then stop the drill BEFORE the POST.
       Otherwise the finished drill keeps painting at 60 fps behind its own
       results card for the whole round-trip - and that round-trip runs
       Save-Store on the single-threaded bridge, the slowest thing in the
       system. killLive is idempotent, so closeLesson calling it again is fine.
       The results card is DOM and stays up; only the animation stops. */
    var ms = elapsed();
    killLive();
    post(id, 'complete', score, ms).then(function(){
      toast(Ls.def.title + ' — complete');
      closeLesson(true, 'complete');
    });
  }

  /* record a score without marking the lesson complete */
  function bank(score){
    var Ls = S.lesson;
    if(!Ls || Ls.done) return;
    Ls.done = true;
    var ms = elapsed();
    killLive();                 /* same reason as complete() above */
    post(Ls.def.id, 'in-progress', score, ms).then(function(){
      closeLesson(true, 'banked');
    });
  }

  function closeLesson(alreadySaved, how){
    var Ls = S.lesson;
    killLive();
    if(Ls && !Ls.done && !alreadySaved){
      /* walked away part-way: bank the time, leave it in-progress */
      post(Ls.def.id, 'in-progress', null, elapsed());
    }
    /* ONE-LESSON MODE (?lesson=<id>, 2026-10-10): the website's badge page
       opens a single lesson in a frame. When it ends, tell the page (which
       offers the next one) instead of showing the syllabus. The kiosk never
       passes ?lesson=, so this never runs there. */
    if(DEEP && framed()){
      try{ window.parent.postMessage({ source:'groundschool', action:'lessonClosed', id: Ls ? Ls.def.id : DEEP,
                                       how: how || 'exit' }, window.location.origin); }catch(e){}
      return;
    }
    S.lesson = null;
    el('lesson').classList.remove('on');
    el('syllabusWrap').classList.remove('off');
    el('lBody').innerHTML = '';
    renderSyllabus();
    paintPilot();
  }

  /* ---------------------------------------------------------------- boot */
  var DEEP = (function(){ try{ return new URLSearchParams(window.location.search).get('lesson'); }catch(e){ return null; } })();
  function boot(){
    Promise.all([
      api('/api/active').catch(function(){ return { profile:null }; }),
      api('/api/groundschool/catalog').catch(function(){ return { passScore:80, lessons:[] }; })
    ]).then(function(res){
      var act = res[0], cat = res[1];

      S.passScore = cat.passScore || 80;
      (cat.lessons || []).forEach(function(l){ S.catalogIds[l.id] = true; });
      S.catalogStale = GS_COURSE.some(function(l){ return !S.catalogIds[l.id]; });

      if(act && act.profile) adopt(act.profile);
      else paintPilot();

      renderSyllabus();

      if(!S.profile) el('gate').classList.add('show');
      else if(DEEP && lessonById(DEEP)) openLesson(DEEP);
      if(S.catalogStale){
        console.warn('[ground school] the catalogue on the bridge does not match gs-content.js - ' +
                     'config.json has changed but the kiosk has not been restarted. ' +
                     'Lessons will run; progress will not be recorded.');
      }
    });
  }

  /* ------------------------------------------------------------- wiring */
  function wire(){
    el('backBtn').onclick  = function(){ leave(); };
    el('gateBack').onclick = function(){ leave(); };

    /* Framed: the hangar's own bar is directly above this page with a "Back to
       the hangar" button on it. A second one inside the frame is both redundant
       and, since it cannot navigate, misleading. */
    if(framed()){
      el('backBtn').style.display = 'none';
      el('gateBack').textContent = 'Use "Back to the hangar" above';
    }

    el('lExit').onclick = function(){ closeLesson(false); };
    el('lPrev').onclick = function(){
      var Ls = S.lesson; if(!Ls || Ls.i === 0) return;
      Ls.i--; drawStep();
    };
    el('lNext').onclick = function(){
      var Ls = S.lesson; if(!Ls) return;
      if(Ls.i < Ls.steps.length - 1){ Ls.i++; drawStep(); return; }
      /* last step of a reading lesson with no check: full marks for reading it */
      complete(100);
    };

    el('resetBtn').onclick = function(){
      if(!S.profile){ el('gate').classList.add('show'); return; }
      el('resetWho').textContent = S.profile.name;
      el('resetScrim').classList.add('show');
    };
    el('resetNo').onclick  = function(){ el('resetScrim').classList.remove('show'); };
    el('resetYes').onclick = function(){
      el('resetScrim').classList.remove('show');
      var ids = GS_COURSE.map(function(l){ return l.id; });
      /* Sequentially, not in parallel: each POST runs a Save-Store on a
         single-threaded bridge, and eighteen at once would stall the kiosk. */
      var i = 0;
      (function step(){
        if(i >= ids.length){ toast('Course reset — start anywhere'); renderSyllabus(); return; }
        post(ids[i++], 'not-started').then(step);
      })();
    };

    /* Escape closes whatever is open, innermost first */
    window.addEventListener('keydown', function(e){
      if(e.key !== 'Escape') return;
      if(el('resetScrim').classList.contains('show')){ el('resetScrim').classList.remove('show'); return; }
      if(S.lesson){ closeLesson(false); return; }
      leave();
    });

    /* Leaving the page mid-lesson still banks the time. pagehide fires on
       navigation away, which is how this app is normally exited. */
    window.addEventListener('pagehide', function(){
      var Ls = S.lesson;
      if(Ls && !Ls.done) post(Ls.def.id, 'in-progress', null, elapsed(), true);
    });
  }

  /* Are we inside the kiosk page's #course frame?

     Since 2026-08-21 the hangar opens Ground School in an iframe instead of
     navigating, because navigating unloaded the kiosk page and took ESCAPE,
     the session clock, idle detection and quiet hours down with it.

     The consequence for THIS file: window.location must never be used to go
     "back". Inside the frame it would load index.html *into the frame*, and
     that nested copy polls /api/state?client=kiosk - which consumes the
     one-shot showAdmin flag the real page is sitting there waiting for. So
     ESCAPE would break in a new and harder-to-find way.

     The frame supplies its own "Back to the hangar" button, so ours is hidden
     when framed and we ask the host to close instead. */
  function framed(){
    try { return !!(window.parent && window.parent !== window); }
    catch(e){ return true; }              /* opaque parent - assume framed */
  }

  function leave(){
    var Ls = S.lesson;
    if(Ls && !Ls.done) post(Ls.def.id, 'in-progress', null, elapsed(), true);
    if(framed()){
      /* Ask the hangar to close the frame. Harmless if it is not listening -
         its own Back button is right there and still works. Never navigate. */
      try{
        window.parent.postMessage({ source:'groundschool', action:'close' },
                                  window.location.origin);
      }catch(e){}
      return;
    }
    window.location.href = '../';
  }

  /* ---------------------------------------------------------------------- */
  wire();
  boot();

  return { toast:toast, state:S };
})();
