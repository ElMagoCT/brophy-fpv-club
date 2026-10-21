/* ===========================================================================
   FPV GROUND SCHOOL - SIMULATION DRILLS
   ---------------------------------------------------------------------------
   The canvas drills: stick check, rate/angle, hover, throttle discipline,
   orientation, gate run, recovery. The non-simulation drills (go/no-go, motor
   picker, battery math, channels) live in gs-panels.js.

   EVERY DRILL HAS THE SAME SHAPE

     GSDrills.<name>(root, ctx, opt)  ->  { stop:function(){} }

       root   an empty element to fill
       ctx    { finish(score, extra), hint(text), lesson }
       opt    per-drill options; used by the checkride to run cut-down
              versions of the hover and orientation drills

   finish() is called exactly once, with a score 0-100 and an optional object
   of extra fields. Those extras are written into the student's lesson record -
   the bridge preserves fields it doesn\'t recognize, so bestLevel and
   bestHoldPct survive without a line of PowerShell changing.

   A drill must call ctx.finish() or the lesson can\'t complete. If a student
   walks away mid-drill, stop() tears down the animation frame and the app
   banks the time with the lesson still in-progress.
   =========================================================================== */

var GSDrills = (function(){

  /* ======================================================================
     SHARED HELPERS
     ====================================================================== */

  function h(tag, cls, html){
    var e = document.createElement(tag);
    if(cls) e.className = cls;
    if(html != null) e.innerHTML = html;
    return e;
  }

  /* A canvas that\'s crisp on the kiosk's 125% scaling. The logical drawing
     size is fixed so every drill can use plain world units; the backing store
     is sized to the device. */
  function makeStage(parent, logicalW, logicalH){
    var stage = h('div','stage');
    var cv = document.createElement('canvas');
    stage.appendChild(cv);
    var over = h('div','stageover');
    stage.appendChild(over);
    parent.appendChild(stage);

    var g = cv.getContext('2d');
    function size(){
      var cssW = stage.clientWidth || logicalW;
      var cssH = Math.round(cssW * logicalH / logicalW);
      var dpr  = Math.min(2, window.devicePixelRatio || 1);
      cv.style.height = cssH + 'px';
      cv.width  = Math.round(cssW * dpr);
      cv.height = Math.round(cssH * dpr);
      /* one transform, so all drawing is in logical units */
      var s = (cssW * dpr) / logicalW;
      g.setTransform(s, 0, 0, s, 0, 0);
    }
    size();
    var ro = null;
    if(window.ResizeObserver){ ro = new ResizeObserver(size); ro.observe(stage); }
    else { window.addEventListener('resize', size); }

    return {
      el:stage, canvas:cv, g:g, over:over, W:logicalW, H:logicalH,
      resize:size,
      teardown:function(){ if(ro) ro.disconnect(); else window.removeEventListener('resize', size); }
    };
  }

  /* HUD strip above a stage. spec: [{id,k,v}] */
  function makeHud(parent, spec){
    var el = h('div','hud');
    var cells = {};
    spec.forEach(function(s){
      var c = h('div','cell');
      c.appendChild(h('span','k', s.k));
      var v = h('span','v', s.v == null ? '-' : s.v);
      c.appendChild(v);
      el.appendChild(c);
      cells[s.id] = v;
    });
    el.appendChild(h('span','spacer'));
    var src = h('span','src','');
    el.appendChild(src);
    parent.appendChild(el);
    /* Both writers are called from inside a 60 fps loop, so both compare before
       they touch the DOM. set() was doing eight to ten pointless mutations a
       frame; showSource() was rebuilding identical innerHTML AND taking a fresh
       getGamepads snapshot every frame in order to do it. */
    var lastSrc = null;
    return {
      el:el, cells:cells,
      set:function(id, val, cls){
        var c = cells[id]; if(!c) return;
        var txt = String(val);
        var cn  = 'v' + (cls ? ' ' + cls : '');
        if(c._txt === txt && c._cn === cn) return;
        c._txt = txt; c._cn = cn;
        c.textContent = txt;
        c.className = cn;
      },
      showSource:function(){
        var s = GSInput.source();
        if(s === lastSrc) return;
        lastSrc = s;
        src.innerHTML = s === 'stick'
          ? 'input &middot; <b>TRANSMITTER</b>'
          : 'input &middot; keyboard';
      }
    };
  }

  /* a requestAnimationFrame loop with a real dt and a stop() */
  function makeLoop(step){
    var raf = 0, last = 0, dead = false;
    function frame(t){
      if(dead) return;
      if(!last) last = t;
      var dt = Math.min(0.05, (t - last) / 1000);   /* clamp: a background tab
                                                        must not integrate a
                                                        two-second step */
      last = t;
      step(dt, t);
      if(!dead) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return { stop:function(){ dead = true; if(raf) cancelAnimationFrame(raf); } };
  }

  /* Is the stage overlay up - a brief, a level break, a results card?

     Every drill's draw block sits OUTSIDE its `if(running)` guard, so the
     canvas was being fully repainted at 60 fps behind an opaque overlay: the
     grid, the world, the aircraft, all of it invisible. Each drill now bails
     out of its draw with this.

     Note what is deliberately NOT done here: the loop itself keeps running.
     Four of the drills update a live two-stick visualiser that lives in the
     brief, OUTSIDE the stage and not covered by the overlay - and the sticks
     drill's intro overlay literally tells the student to "move a stick to wake
     it up". Skipping the whole step would freeze that and make a working radio
     look dead. So the cheap logic stays; only the expensive painting stops. */
  function overlayOn(stage){
    return stage.over.classList.contains('on');
  }

  /* the overlay used for briefs, level breaks and results */
  function showOver(stage, opts){
    var o = stage.over;
    o.innerHTML = '';
    var box = h('div');
    if(opts.title){
      var t = h('h4', opts.cls || '', opts.title);
      box.appendChild(t);
    }
    if(opts.big != null) box.appendChild(h('div','big', opts.big));
    if(opts.sub) box.appendChild(h('div','sub', opts.sub));
    if(opts.buttons && opts.buttons.length){
      var bs = h('div','btns');
      opts.buttons.forEach(function(b){
        var btn = h('button','minibtn big' + (b.cls ? ' ' + b.cls : ''), b.label);
        btn.onclick = b.onClick;
        bs.appendChild(btn);
      });
      box.appendChild(bs);
    }
    if(opts.keyhint) box.appendChild(h('div','keyhint', opts.keyhint));
    o.appendChild(box);
    o.classList.add('on');
  }
  function hideOver(stage){ stage.over.classList.remove('on'); stage.over.innerHTML=''; }

  function brief(parent, title, body, right){
    var b = h('div','drillbrief');
    var b1 = h('div','b1');
    b1.appendChild(h('h4','',title));
    b1.appendChild(h('p','',body));
    b.appendChild(b1);
    if(right){ var b2 = h('div','b2'); b2.appendChild(right); b.appendChild(b2); }
    parent.appendChild(b);
    return b;
  }

  function clamp(v,a,b){ return v < a ? a : (v > b ? b : v); }
  function fmt1(v){ return (Math.round(v*10)/10).toFixed(1); }

  /* ---- sketch-idiom drawing primitives, shared by the canvas drills ---- */
  var INK   = '#1f3350', INKS = '#546881', RUST = '#8f3d12',
      GREEN = '#1f5230', AMBER = '#7d5810', PAPER = '#f2ece0',
      PAPER2= '#eae2d1', SKY   = '#1c5578';

  function gridBg(g, W, H){
    g.fillStyle = 'rgba(255,253,247,.55)';
    g.fillRect(0,0,W,H);
    g.strokeStyle = 'rgba(31,51,80,.10)';
    g.lineWidth = 1;
    /* One path, one stroke. This used to be a beginPath/stroke per line - about
       55 separate strokes every frame, on every drill. */
    g.beginPath();
    for(var x=0;x<=W;x+=28){ g.moveTo(x,0); g.lineTo(x,H); }
    for(var y=0;y<=H;y+=28){ g.moveTo(0,y); g.lineTo(W,y); }
    g.stroke();
  }

  function hatchGround(g, W, y){
    g.strokeStyle = INK; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke();
    g.strokeStyle = 'rgba(31,51,80,.34)'; g.lineWidth = 1.4;
    for(var x=8;x<W;x+=22){
      g.beginPath(); g.moveTo(x,y); g.lineTo(x-9,y+13); g.stroke();
    }
  }

  /* the quad, side on, banked by roll */
  function drawQuadSide(g, x, y, roll, scale){
    scale = scale || 1;
    g.save();
    g.translate(x,y); g.rotate(roll); g.scale(scale,scale);
    g.strokeStyle = INK; g.lineWidth = 3.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-22,0); g.lineTo(22,0); g.stroke();
    g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(-22,0); g.lineTo(-22,-7); g.moveTo(22,0); g.lineTo(22,-7); g.stroke();
    /* props */
    g.strokeStyle = RUST; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-34,-9); g.lineTo(-10,-9); g.moveTo(10,-9); g.lineTo(34,-9); g.stroke();
    /* body */
    g.fillStyle = PAPER2; g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.rect(-10,-4,20,8); g.fill(); g.stroke();
    g.restore();
  }

  /* the quad, top down, with a nose marker */
  function drawQuadTop(g, x, y, heading, scale, noseColour){
    scale = scale || 1;
    g.save();
    g.translate(x,y); g.rotate(heading); g.scale(scale,scale);
    g.strokeStyle = INK; g.lineWidth = 3.4; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-15,-15); g.lineTo(15,15); g.moveTo(15,-15); g.lineTo(-15,15);
    g.stroke();
    /* rear motors hollow, front motors filled - a second orientation cue */
    g.lineWidth = 2.2;
    [[-15,15],[15,15]].forEach(function(p){
      g.fillStyle = noseColour || RUST;
      g.beginPath(); g.arc(p[0],p[1],6,0,6.2832); g.fill();
    });
    [[-15,-15],[15,-15]].forEach(function(p){
      g.strokeStyle = INKS; g.fillStyle = PAPER;
      g.beginPath(); g.arc(p[0],p[1],6,0,6.2832); g.fill(); g.stroke();
    });
    /* nose */
    g.fillStyle = noseColour || RUST;
    g.beginPath(); g.moveTo(0,-13); g.lineTo(-7,-27); g.lineTo(7,-27); g.closePath(); g.fill();
    g.restore();
  }

  function drawPilot(g, x, y){
    g.fillStyle = INK;
    g.beginPath(); g.arc(x,y,7,0,6.2832); g.fill();
    g.strokeStyle = 'rgba(31,51,80,.40)'; g.lineWidth = 1.4;
    g.setLineDash([3,4]);
    g.beginPath(); g.arc(x,y,17,Math.PI,0); g.stroke();
    g.setLineDash([]);
    g.fillStyle = INKS; g.font = '11px "Share Tech Mono", monospace';
    g.textAlign = 'center';
    g.fillText('YOU', x, y+22);
  }

  function label(g, x, y, text, color, size, align){
    g.fillStyle = color || INKS;
    g.font = (size||11) + 'px "Share Tech Mono", monospace';
    g.textAlign = align || 'left';
    g.fillText(text, x, y);
  }

  /* the little two-stick visualiser, as a DOM element */
  function makeSticks(){
    var w = h('div','sticks');
    function box(lbl){
      var b = h('div','stickbox');
      var p = h('div','stickpad');
      var i = h('i');
      p.appendChild(i);
      b.appendChild(p);
      b.appendChild(h('div','sl',lbl));
      return { el:b, dot:i };
    }
    var L = box('throttle / yaw'), R = box('pitch / roll');
    w.appendChild(L.el); w.appendChild(R.el);
    return {
      el:w,
      update:function(a){
        /* throttle 0..1 maps bottom..top */
        L.dot.style.left = (50 + a.yaw*42) + '%';
        L.dot.style.top  = (100 - a.thr*100) * 0.84 + 8 + '%';
        R.dot.style.left = (50 + a.roll*42) + '%';
        R.dot.style.top  = (50 - a.pitch*42) + '%';
      }
    };
  }

  /* ======================================================================
     gs-fly-01 - STICK CHECK, and the calibration that every later drill
     depends on.
     ====================================================================== */
  function sticks(root, ctx){
    var PROMPTS = [
      { k:'thr',   want:'up',    text:'CLIMB',        hint:'throttle up' },
      { k:'thr',   want:'down',  text:'DESCEND',      hint:'throttle down' },
      { k:'yaw',   want:'left',  text:'SPIN LEFT',    hint:'yaw left' },
      { k:'yaw',   want:'right', text:'SPIN RIGHT',   hint:'yaw right' },
      { k:'pitch', want:'up',    text:'MOVE FORWARD', hint:'pitch forward' },
      { k:'pitch', want:'down',  text:'MOVE BACK',    hint:'pitch back' },
      { k:'roll',  want:'left',  text:'LEAN LEFT',    hint:'roll left' },
      { k:'roll',  want:'right', text:'LEAN RIGHT',   hint:'roll right' }
    ];

    var wrap = h('div','drill');
    root.appendChild(wrap);

    var sticksVis = makeSticks();
    brief(wrap, 'Stick check',
      'The prompt names a movement. Make it, and hold it for a moment. If your transmitter is plugged in this also proves the channels are mapped the way you think they\'re.',
      sticksVis.el);

    var hud = makeHud(wrap, [
      { id:'round', k:'Prompt', v:'1 / 8' },
      { id:'ok',    k:'Correct', v:'0' },
      { id:'ask',   k:'Do this', v:'-' }
    ]);
    var stage = makeStage(wrap, 1000, 300);
    var g = stage.g;

    var mode = 'intro';           /* intro | calib | run | done */
    var idx = 0, correct = 0, hold = 0;
    var cal = null, calStep = 0, calCand = null, calHold = 0;
    var CAL_ORDER = [
      { k:'thr',   say:'Push the THROTTLE stick all the way UP and hold it' },
      { k:'yaw',   say:'Push the same stick fully LEFT or RIGHT and hold it' },
      { k:'pitch', say:'Push the OTHER stick fully FORWARD and hold it' },
      { k:'roll',  say:'Push that stick fully to one SIDE and hold it' }
    ];

    function startIntro(){
      mode = 'intro';
      if(GSInput.hasPad() && !GSInput.isMapped()){
        showOver(stage, {
          title:'Transmitter found',
          sub:'Before anything else, four quick moves so the app learns which axis is which on your radio. Every drill after this one uses it.',
          buttons:[
            { label:'Calibrate', cls:'go', onClick:startCal },
            { label:'Skip, use keyboard', onClick:startRun }
          ]
        });
      } else if(GSInput.hasPad() && GSInput.isMapped()){
        showOver(stage, {
          title:'Transmitter ready',
          sub:'Your radio is already calibrated. Eight prompts - make each movement and hold it briefly.',
          buttons:[
            { label:'Start', cls:'go', onClick:startRun },
            { label:'Recalibrate', onClick:function(){ GSInput.clearMap(); startCal(); } }
          ]
        });
      } else {
        showOver(stage, {
          title:'No transmitter detected',
          sub:'Plug the radio in and move a stick to wake it up, or run this on the keyboard: W and S for throttle, A and D for yaw, arrow keys for pitch and roll.',
          buttons:[
            { label:'Use the keyboard', cls:'go', onClick:startRun },
            { label:'Look again', onClick:function(){
                if(GSInput.hasPad()) startIntro(); else GSApp.toast('Still nothing. Move a stick on the radio.');
              } }
          ]
        });
      }
    }

    function startCal(){
      cal = new GSInput.Calibrator();
      if(!cal.takeRest()){ GSApp.toast('Lost the transmitter. Move a stick.'); return; }
      calStep = 0; calCand = null; calHold = 0;
      mode = 'calib';
      hideOver(stage);
      ctx.hint('Calibrating - hold each movement until it locks');
    }

    function startRun(){
      mode = 'run'; idx = 0; correct = 0; hold = 0;
      hideOver(stage);
      ctx.hint(GSInput.source() === 'stick'
        ? 'Transmitter live - hold each movement'
        : 'W/S throttle, A/D yaw, arrows pitch and roll');
    }

    /* did the axes satisfy the current prompt? */
    function satisfied(a, p){
      var TH = 0.55;
      if(p.k === 'thr')   return p.want === 'up' ? a.thr > 0.80 : a.thr < 0.12;
      if(p.k === 'yaw')   return p.want === 'left' ? a.yaw < -TH : a.yaw > TH;
      if(p.k === 'pitch') return p.want === 'up' ? a.pitch > TH : a.pitch < -TH;
      if(p.k === 'roll')  return p.want === 'left' ? a.roll < -TH : a.roll > TH;
      return false;
    }

    var loop = makeLoop(function(dt){
      var a = GSInput.axes();
      sticksVis.update(a);
      hud.showSource();

      if(mode === 'calib'){
        var want = CAL_ORDER[calStep];
        var cand = cal.watch();
        if(cand && calCand && cand.axis === calCand.axis && cand.sign === calCand.sign){
          calHold += dt;
        } else {
          calCand = cand; calHold = 0;
        }
        if(calCand && calHold > 0.45){
          cal.commit(want.k, calCand);
          calStep++; calCand = null; calHold = 0;
          if(calStep >= CAL_ORDER.length){
            if(cal.finish()){
              GSApp.toast('Transmitter calibrated');
              startRun();
            } else {
              showOver(stage, {
                title:'Calibration failed', cls:'lose',
                sub:'Two channels came out on the same axis. Center every stick, then try again.',
                buttons:[{ label:'Try again', cls:'go', onClick:startCal },
                         { label:'Use the keyboard', onClick:startRun }]
              });
              mode = 'intro';
            }
          }
        }
      }

      if(mode === 'run'){
        var p = PROMPTS[idx];
        hud.set('round', (idx+1) + ' / ' + PROMPTS.length);
        hud.set('ok', String(correct));
        hud.set('ask', p.text, 'warn');
        if(satisfied(a, p)){
          hold += dt;
          if(hold > 0.30){
            correct++; idx++; hold = 0;
            if(idx >= PROMPTS.length){
              mode = 'done';
              var score = Math.round(correct / PROMPTS.length * 100);
              showOver(stage, {
                title:'Channels confirmed', cls:'win',
                big:score,
                sub:'All four channels do what they should. That mapping is saved and every drill from here uses it.',
                buttons:[{ label:'Finish lesson', cls:'go', onClick:function(){
                  ctx.finish(score, { inputSource: GSInput.source(), calibrated: GSInput.isMapped() });
                } }]
              });
            }
          }
        } else {
          hold = Math.max(0, hold - dt*0.5);
        }
      }

      /* ---- draw ---- */
      if(overlayOn(stage)) return;          /* nothing visible behind it */
      gridBg(g, stage.W, stage.H);
      if(mode === 'calib'){
        var w = CAL_ORDER[calStep];
        label(g, stage.W/2, 96, 'CALIBRATION  ' + (calStep+1) + ' / 4', RUST, 15, 'center');
        g.fillStyle = INK; g.font = '600 27px "Barlow", sans-serif'; g.textAlign='center';
        g.fillText(w.say, stage.W/2, 146);
        if(calCand){
          label(g, stage.W/2, 190, 'axis ' + calCand.axis + ' moving - hold it', GREEN, 15, 'center');
          g.fillStyle = GREEN;
          g.fillRect(stage.W/2 - 120, 206, Math.min(240, 240 * (calHold/0.45)), 9);
          g.strokeStyle = INKS; g.lineWidth = 1.4;
          g.strokeRect(stage.W/2 - 120, 206, 240, 9);
        } else {
          label(g, stage.W/2, 190, 'waiting for a full deflection', INKS, 14, 'center');
        }
      } else if(mode === 'run'){
        var pr = PROMPTS[idx];
        label(g, stage.W/2, 78, 'MAKE IT', INKS, 13, 'center');
        g.fillStyle = RUST; g.font = '64px "Cabin Sketch", cursive'; g.textAlign='center';
        g.fillText(pr.text, stage.W/2, 148);
        label(g, stage.W/2, 184, pr.hint, INKS, 15, 'center');
        /* hold meter */
        g.strokeStyle = INKS; g.lineWidth = 1.4;
        g.strokeRect(stage.W/2 - 90, 208, 180, 10);
        g.fillStyle = hold > 0 ? GREEN : 'rgba(31,51,80,.12)';
        g.fillRect(stage.W/2 - 90, 208, Math.min(180, 180 * (hold/0.30)), 10);
      }
    });

    startIntro();
    return { stop:function(){ loop.stop(); stage.teardown(); } };
  }

  /* ======================================================================
     gs-fly-02 - RATE AGAINST ANGLE
     Same aircraft, one toggle. Hold it level in each mode.
     ====================================================================== */
  function rateAngle(root, ctx){
    var PHASE_SECS = 20;
    var wrap = h('div','drill'); root.appendChild(wrap);
    var sv = makeSticks();
    brief(wrap, 'Feel the difference',
      'Keep it level. <b>Angle mode first:</b> let go and it recovers by itself. Then <b>rate mode:</b> let go and it keeps whatever bank you left it at. Twenty seconds each.',
      sv.el);

    var hud = makeHud(wrap, [
      { id:'mode', k:'Mode', v:'ANGLE' },
      { id:'time', k:'Left', v:'20' },
      { id:'lvl',  k:'Level', v:'0%' },
      { id:'bank', k:'Bank', v:'0' }
    ]);
    var stage = makeStage(wrap, 1000, 400);
    var g = stage.g;

    var phase = 0;                 /* 0 angle, 1 rate */
    var running = false, t = 0, roll = 0, inBand = 0, results = [];

    function startPhase(){
      roll = (phase === 0 ? 0.35 : 0.42) * (phase === 0 ? 1 : -1);
      t = 0; inBand = 0; running = true;
      hideOver(stage);
      ctx.hint(phase === 0
        ? 'ANGLE mode - center the stick and it levels itself'
        : 'RATE mode - centering the stick only stops the rotation');
    }

    function endPhase(){
      running = false;
      var pct = Math.round(inBand / PHASE_SECS * 100);
      results.push(pct);
      if(phase === 0){
        showOver(stage, {
          title:'Angle mode: ' + pct + '% level',
          sub:'Now the same thing with no self-leveling. Centering the stick will stop it rotating - it won\'t bring it back.',
          buttons:[{ label:'Switch to rate mode', cls:'go', onClick:function(){ phase=1; startPhase(); } }]
        });
      } else {
        var score = Math.round(results[0]*0.35 + results[1]*0.65);
        showOver(stage, {
          title:'Both modes flown', cls:'win', big:score,
          sub:'Angle ' + results[0] + '% level, rate ' + results[1] + '% level. Rate is weighted higher because it\'s the one that needs the practice.',
          buttons:[
            { label:'Finish lesson', cls:'go', onClick:function(){
                ctx.finish(score, { anglePct:results[0], ratePct:results[1] });
              } },
            { label:'Try again', onClick:function(){ phase=0; results=[]; startPhase(); } }
          ]
        });
      }
    }

    var loop = makeLoop(function(dt){
      var a = GSInput.axes();
      sv.update(a);
      hud.showSource();

      if(running){
        t += dt;
        if(phase === 0){
          /* angle mode: the stick asks for a lean, and it chases it */
          var want = a.roll * 0.7;
          roll += (want - roll) * Math.min(1, dt * 5.5);
        } else {
          /* rate mode: the stick asks for a rotation speed. Plus a slow bias,
             so "do nothing" isn\'t a winning strategy. */
          roll += a.roll * 2.6 * dt;
          roll += 0.13 * dt;
          roll = clamp(roll, -Math.PI, Math.PI);
        }
        var level = Math.abs(roll) < 0.19;
        if(level) inBand += dt;
        hud.set('mode', phase === 0 ? 'ANGLE' : 'RATE', phase === 0 ? 'good' : 'warn');
        hud.set('time', Math.max(0, Math.ceil(PHASE_SECS - t)));
        hud.set('lvl', Math.round(inBand / Math.max(0.001,t) * 100) + '%', level ? 'good' : '');
        hud.set('bank', Math.round(roll * 57.3) + '°', level ? 'good' : 'bad');
        if(t >= PHASE_SECS) endPhase();
      }

      if(overlayOn(stage)) return;          /* nothing visible behind it */
      gridBg(g, stage.W, stage.H);
      var cy = stage.H * 0.52;
      /* the level reference */
      g.strokeStyle = 'rgba(31,51,80,.30)'; g.lineWidth = 1.6; g.setLineDash([7,6]);
      g.beginPath(); g.moveTo(90,cy); g.lineTo(stage.W-90,cy); g.stroke();
      g.setLineDash([]);
      label(g, 96, cy - 14, 'LEVEL', INKS, 12);
      /* the tolerance wedge */
      g.strokeStyle = 'rgba(45,106,62,.45)'; g.lineWidth = 1.4;
      [-0.19, 0.19].forEach(function(r){
        g.save(); g.translate(stage.W/2, cy); g.rotate(r);
        g.beginPath(); g.moveTo(-190,0); g.lineTo(190,0); g.stroke();
        g.restore();
      });
      drawQuadSide(g, stage.W/2, cy, roll, 2.3);
      if(Math.abs(roll) < 0.19){
        label(g, stage.W/2, cy + 96, 'LEVEL', GREEN, 17, 'center');
      } else {
        label(g, stage.W/2, cy + 96, Math.abs(Math.round(roll*57.3)) + '° off', RUST, 17, 'center');
      }
    });

    showOver(stage, {
      title:'Angle mode first',
      sub:'Twenty seconds. Keep the aircraft between the two green lines. Roll is the only channel that does anything here.',
      buttons:[{ label:'Start', cls:'go', onClick:startPhase }],
      keyhint:'left / right arrow, or the right stick'
    });
    return { stop:function(){ loop.stop(); stage.teardown(); } };
  }

  /* ======================================================================
     gs-fly-03 - HOVER TRAINER
     Three levels. Also used by the checkride as a single cut-down level.
     ====================================================================== */
  function hover(root, ctx, opt){
    opt = opt || {};
    var SECS   = opt.secs || 45;
    var LEVELS = opt.levels || [
      { n:1, wind:0,    rate:false, xbox:false, brief:'Throttle only. Hold the altitude band - roll is locked out.' },
      { n:2, wind:0.85, rate:false, xbox:true,  brief:'Roll unlocked and the wind is on. Hold the box, not just the height.' },
      { n:3, wind:0.85, rate:true,  xbox:true,  brief:'Same box, rate mode. Nothing levels itself now.' }
    ];

    var wrap = h('div','drill'); root.appendChild(wrap);
    var sv = makeSticks();
    brief(wrap, 'Hover Trainer',
      'A hover isn\'t something you set, it\'s something you keep. Small corrections, made early. Touch the ground and the attempt ends.',
      sv.el);

    var hud = makeHud(wrap, [
      { id:'lvl',  k:'Level', v:'1' },
      { id:'time', k:'Left',  v:String(SECS) },
      { id:'in',   k:'In box', v:'0%' },
      { id:'alt',  k:'Alt',   v:'0.0 m' },
      { id:'wind', k:'Wind',  v:'-' }
    ]);
    var stage = makeStage(wrap, 1000, 520);
    var g = stage.g;

    /* world: x -12..12 m, y 0..14 m */
    var WX = 12, WY = 14;
    function sx(x){ return stage.W/2 + (x / WX) * (stage.W/2 - 60); }
    function sy(y){ return stage.H - 52 - (y / WY) * (stage.H - 96); }

    var li = 0, running = false;
    var t, inBox, st, wind, windT, results = [];

    function reset(){
      var L = LEVELS[li];
      st = { x:0, y:5.2, vx:0, vy:0, roll:0 };
      t = 0; inBox = 0; wind = 0; windT = 0;
      GSInput.presetThrottle(0.52);
      hud.set('lvl', String(L.n));
      hud.set('wind', L.wind ? 'ON' : 'calm');
    }
    function startLevel(){
      reset(); running = true; hideOver(stage);
      ctx.hint(LEVELS[li].brief);
    }
    function boxOf(){
      var L = LEVELS[li];
      return { yLo:4.0, yHi:6.6, xHalf: L.xbox ? 2.6 : WX };
    }
    function endLevel(crashed){
      running = false;
      var L = LEVELS[li];
      var pct = crashed ? Math.round(inBox / SECS * 100 * 0.5) : Math.round(inBox / SECS * 100);
      results.push(pct);
      var last = (li >= LEVELS.length - 1);
      var sub = crashed
        ? 'You touched the ground, so this attempt is halved. ' + pct + '% of the time in the box.'
        : pct + '% of the time in the box.';
      if(last){
        var score = Math.round(results.reduce(function(a,b){return a+b;},0) / results.length);
        var best = 0;
        results.forEach(function(p,i){ if(p >= 70) best = LEVELS[i].n; });
        showOver(stage, {
          title: crashed ? 'Down' : 'Time', cls: crashed ? 'lose' : 'win',
          big:score,
          sub:sub + ' Averaged across all three levels. Deepest level held at 70% or better: ' + (best || 'none') + '.',
          buttons:[
            { label:'Finish lesson', cls:'go', onClick:function(){
                ctx.finish(score, { bestLevel:best, bestHoldPct:Math.max.apply(null, results), levelPcts:results.join('/') });
              } },
            { label:'Run it again', onClick:function(){ li=0; results=[]; startLevel(); } }
          ]
        });
      } else {
        showOver(stage, {
          title: crashed ? 'Down - level ' + L.n : 'Level ' + L.n + ' done',
          cls: crashed ? 'lose' : 'win', big:pct, sub:sub,
          buttons:[
            { label:'Next level', cls:'go', onClick:function(){ li++; startLevel(); } },
            { label:'Retry this level', onClick:function(){ results.pop(); startLevel(); } }
          ]
        });
      }
    }

    reset();

    var loop = makeLoop(function(dt){
      var a = GSInput.axes();
      sv.update(a);
      hud.showSource();
      var L = LEVELS[li], box = boxOf();

      if(running){
        t += dt;
        /* gusting wind: a slow sine plus a faster one, so it\'s never a
           constant you can simply trim out */
        windT += dt;
        wind = L.wind * (Math.sin(windT*0.55) * 0.7 + Math.sin(windT*1.9 + 1.1) * 0.3);

        var rollIn = L.xbox ? a.roll : 0;
        if(L.rate){ st.roll += rollIn * 2.4 * dt; st.roll = clamp(st.roll, -1.2, 1.2); }
        else      { st.roll += (rollIn * 0.62 - st.roll) * Math.min(1, dt*6); }

        /* thrust maps 0..1 to 0..2.1g, so hover sits near 0.47 */
        var T = a.thr * 20.6;
        st.vy += (T * Math.cos(st.roll) - 9.81) * dt;
        st.vx += (T * Math.sin(st.roll) + wind) * dt;
        st.vy -= st.vy * 0.42 * dt;
        st.vx -= st.vx * 0.62 * dt;
        st.y  += st.vy * dt;
        st.x  += st.vx * dt;

        if(st.x < -WX){ st.x = -WX; st.vx = 0; }
        if(st.x >  WX){ st.x =  WX; st.vx = 0; }
        if(st.y > WY){ st.y = WY; st.vy = 0; }

        var inside = st.y > box.yLo && st.y < box.yHi && Math.abs(st.x) < box.xHalf;
        if(inside) inBox += dt;

        hud.set('time', Math.max(0, Math.ceil(SECS - t)));
        hud.set('in', Math.round(inBox / Math.max(0.001,t) * 100) + '%', inside ? 'good' : '');
        hud.set('alt', fmt1(st.y) + ' m', inside ? 'good' : 'warn');

        if(st.y <= 0.15){ st.y = 0.15; endLevel(true); }
        else if(t >= SECS) endLevel(false);
      }

      /* ---- draw ---- */
      if(overlayOn(stage)) return;          /* nothing visible behind it */
      gridBg(g, stage.W, stage.H);
      var box2 = boxOf();
      /* target box */
      var bx0 = sx(-box2.xHalf), bx1 = sx(box2.xHalf);
      var by0 = sy(box2.yHi),    by1 = sy(box2.yLo);
      g.fillStyle = 'rgba(143,61,18,.09)';
      g.fillRect(bx0, by0, bx1-bx0, by1-by0);
      g.strokeStyle = RUST; g.lineWidth = 2; g.setLineDash([7,5]);
      g.strokeRect(bx0, by0, bx1-bx0, by1-by0);
      g.setLineDash([]);
      label(g, bx0 + 8, by0 - 9, 'HOLD IT IN HERE', RUST, 12);
      /* center line */
      g.strokeStyle = 'rgba(143,61,18,.45)'; g.lineWidth = 1; g.setLineDash([3,6]);
      g.beginPath(); g.moveTo(bx0, sy(5.3)); g.lineTo(bx1, sy(5.3)); g.stroke();
      g.setLineDash([]);

      /* wind arrows */
      if(LEVELS[li].wind){
        var n = 3, dir = wind >= 0 ? 1 : -1, mag = Math.min(1, Math.abs(wind));
        g.strokeStyle = 'rgba(84,104,129,' + (0.25 + mag*0.55) + ')'; g.lineWidth = 1.8;
        for(var i=0;i<n;i++){
          var yy = 90 + i*54, len = 16 + mag*40;
          var x0 = dir > 0 ? 26 : stage.W - 26;
          g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + dir*len, yy); g.stroke();
          g.beginPath();
          g.moveTo(x0 + dir*len, yy);
          g.lineTo(x0 + dir*(len-7), yy-4);
          g.moveTo(x0 + dir*len, yy);
          g.lineTo(x0 + dir*(len-7), yy+4);
          g.stroke();
        }
        label(g, dir > 0 ? 26 : stage.W - 70, 74, 'WIND', INKS, 11);
      }

      hatchGround(g, stage.W, stage.H - 52);
      drawQuadSide(g, sx(st.x), sy(st.y), st.roll, 1.55);

      /* the throttle column, so a keyboard student can see where it is */
      var tx = stage.W - 34, ty0 = 90, ty1 = stage.H - 90;
      g.strokeStyle = INKS; g.lineWidth = 1.4;
      g.strokeRect(tx-9, ty0, 18, ty1-ty0);
      var th = a.thr;                       /* `a` is already this frame's read */
      g.fillStyle = RUST;
      g.fillRect(tx-9, ty1 - (ty1-ty0)*th, 18, (ty1-ty0)*th);
      label(g, tx, ty0 - 10, 'THR', INKS, 10, 'center');
    });

    showOver(stage, {
      title:'Level 1',
      sub:LEVELS[0].brief + ' Small corrections, made early - if you can see the drift, you\'re already late.',
      buttons:[{ label:'Start', cls:'go', onClick:startLevel }],
      keyhint:'W and S for throttle, arrows for roll'
    });
    return { stop:function(){ loop.stop(); stage.teardown(); } };
  }

  /* ======================================================================
     gs-fly-04 - THROTTLE DISCIPLINE
     Follow a moving altitude target. Scored on tracking AND smoothness.
     ====================================================================== */
  function throttle(root, ctx){
    var SECS = 40;
    var wrap = h('div','drill'); root.appendChild(wrap);
    brief(wrap, 'Throttle discipline',
      'Follow the target line. You\'re scored on <b>two</b> things: how close you stay, and how smooth you were. Perfect tracking with violent inputs still scores badly.');

    var hud = makeHud(wrap, [
      { id:'time', k:'Left', v:String(SECS) },
      { id:'err',  k:'Error', v:'0.0 m' },
      { id:'trk',  k:'Tracking', v:'-' },
      { id:'smo',  k:'Smoothness', v:'-' }
    ]);
    var stage = makeStage(wrap, 1000, 460);
    var g = stage.g;

    var WY = 14;
    function sy(y){ return stage.H - 46 - (y / WY) * (stage.H - 88); }

    var running = false, t = 0, st, errSum = 0, jerkSum = 0, lastThr = 0, trail = [];

    /* the target: two sines, so it\'s smooth but not guessable */
    function target(tt){ return 7 + Math.sin(tt*0.44)*3.1 + Math.sin(tt*0.97 + 2.0)*1.35; }

    function reset(){
      st = { y:target(0), vy:0 };
      t = 0; errSum = 0; jerkSum = 0; lastThr = 0.5; trail = [];
      GSInput.presetThrottle(0.5);
    }
    function start(){ reset(); running = true; hideOver(stage); ctx.hint('Follow the line. Smooth beats fast.'); }

    function end(){
      running = false;
      var meanErr  = errSum / Math.max(0.001, t);
      var meanJerk = jerkSum / Math.max(0.001, t);
      /* 0.35 m mean error is excellent, 2.5 m is hopeless */
      var track = clamp(100 - (meanErr - 0.35) / (2.5 - 0.35) * 100, 0, 100);
      /* 0.35 units/s of throttle movement is smooth, 2.2 is a light switch */
      var smooth = clamp(100 - (meanJerk - 0.35) / (2.2 - 0.35) * 100, 0, 100);
      var score = Math.round(track * 0.6 + smooth * 0.4);
      showOver(stage, {
        title:'Time', cls:'win', big:score,
        sub:'Tracking ' + Math.round(track) + ' (mean error ' + fmt1(meanErr) + ' m), smoothness ' + Math.round(smooth) +
            '. Tracking is 60% of the score, smoothness 40% - because a pilot who chases the line with the throttle wide open isn\'t in control of anything.',
        buttons:[
          { label:'Finish lesson', cls:'go', onClick:function(){
              ctx.finish(score, { trackScore:Math.round(track), smoothScore:Math.round(smooth) });
            } },
          { label:'Try again', onClick:start }
        ]
      });
    }

    reset();

    var loop = makeLoop(function(dt){
      var a = GSInput.axes();
      hud.showSource();

      if(running){
        t += dt;
        var T = a.thr * 20.6;
        st.vy += (T - 9.81) * dt;
        st.vy -= st.vy * 0.42 * dt;
        st.y  += st.vy * dt;
        if(st.y < 0.2){ st.y = 0.2; st.vy = 0; }
        if(st.y > WY){ st.y = WY; st.vy = 0; }

        var want = target(t);
        var err = Math.abs(st.y - want);
        errSum  += err * dt;
        jerkSum += Math.abs(a.thr - lastThr);
        lastThr = a.thr;

        trail.push({ t:t, y:st.y });
        if(trail.length > 900) trail.shift();

        hud.set('time', Math.max(0, Math.ceil(SECS - t)));
        hud.set('err', fmt1(err) + ' m', err < 0.8 ? 'good' : (err < 1.8 ? 'warn' : 'bad'));
        hud.set('trk', Math.round(clamp(100 - ((errSum/t) - 0.35)/(2.5-0.35)*100, 0, 100)));
        hud.set('smo', Math.round(clamp(100 - ((jerkSum/t) - 0.35)/(2.2-0.35)*100, 0, 100)));

        if(t >= SECS) end();
      }

      if(overlayOn(stage)) return;          /* nothing visible behind it */
      gridBg(g, stage.W, stage.H);
      /* the target line, drawn as the future - it scrolls toward you */
      var WINDOW = 11;   /* seconds visible */
      function tx(tt){ return 130 + (tt - t + 2.2) / WINDOW * (stage.W - 190); }
      g.strokeStyle = RUST; g.lineWidth = 2.6;
      g.beginPath();
      for(var k=0;k<=200;k++){
        var tt = t - 2.2 + (k/200)*WINDOW;
        if(tt < 0) continue;
        var X = tx(tt), Y = sy(target(tt));
        if(k===0 || tt < 0.001) g.moveTo(X,Y); else g.lineTo(X,Y);
      }
      g.stroke();
      label(g, stage.W - 58, sy(target(t - 2.2 + WINDOW)) - 12, 'TARGET', RUST, 11, 'center');

      /* your trail */
      g.strokeStyle = 'rgba(31,51,80,.55)'; g.lineWidth = 2;
      g.beginPath();
      var started = false;
      trail.forEach(function(p){
        var X = tx(p.t), Y = sy(p.y);
        if(X < 120) return;
        if(!started){ g.moveTo(X,Y); started = true; } else g.lineTo(X,Y);
      });
      g.stroke();

      /* the now line */
      var nx = tx(t);
      g.strokeStyle = 'rgba(31,51,80,.30)'; g.lineWidth = 1.4; g.setLineDash([5,5]);
      g.beginPath(); g.moveTo(nx, 30); g.lineTo(nx, stage.H - 46); g.stroke();
      g.setLineDash([]);

      hatchGround(g, stage.W, stage.H - 46);
      drawQuadSide(g, nx, sy(st.y), 0, 1.35);

      /* throttle column */
      var cx = 58, cy0 = 60, cy1 = stage.H - 80;
      g.strokeStyle = INKS; g.lineWidth = 1.4;
      g.strokeRect(cx-11, cy0, 22, cy1-cy0);
      g.fillStyle = RUST;
      g.fillRect(cx-11, cy1 - (cy1-cy0)*a.thr, 22, (cy1-cy0)*a.thr);
      label(g, cx, cy0 - 12, 'THROTTLE', INKS, 10, 'center');
    });

    showOver(stage, {
      title:'Follow the line',
      sub:'Forty seconds. The rust line is where you should be. Get there and stay there without stabbing at the throttle.',
      buttons:[{ label:'Start', cls:'go', onClick:start }],
      keyhint:'W and S, or the throttle stick'
    });
    return { stop:function(){ loop.stop(); stage.teardown(); } };
  }

  /* ======================================================================
     gs-los-01 - WHICH WAY IS LEFT?
     No flying. Just the reversal, drilled until it\'s instant.
     Also used by the checkride in a five-round version.
     ====================================================================== */
  function orient(root, ctx, opt){
    opt = opt || {};
    var ROUNDS = opt.rounds || 10;

    var wrap = h('div','drill'); root.appendChild(wrap);
    brief(wrap, 'Which way is left?',
      'The aircraft is at a random heading with a target off to one side. Which way do you push the <b>roll</b> stick to move it toward the flag? Left arrow or right arrow - or the stick itself.');

    var hud = makeHud(wrap, [
      { id:'round', k:'Round', v:'1 / ' + ROUNDS },
      { id:'ok',    k:'Correct', v:'0' },
      { id:'fast',  k:'Last', v:'-' }
    ]);
    var stage = makeStage(wrap, 1000, 470);
    var g = stage.g;

    var idx = 0, correct = 0, times = [], q = null;
    var running = false, tRound = 0, flash = null, flashT = 0, armed = false;

    function newRound(){
      var head = Math.random() * Math.PI * 2;
      var side = Math.random() < 0.5 ? -1 : 1;          /* -1 left of nose */
      var ang  = side * (0.7 + Math.random() * 1.75);   /* 40..143 degrees */
      var dist = 130 + Math.random() * 90;
      var px = stage.W/2 + (Math.random()-0.5) * 300;
      var py = 140 + Math.random() * 130;
      /* body axes in canvas space (y grows downward) */
      var fx =  Math.sin(head), fy = -Math.cos(head);
      var rx =  Math.cos(head), ry =  Math.sin(head);
      q = {
        head:head, side:side,
        dx:px, dy:py,
        tx: px + fx*Math.cos(ang)*dist + rx*Math.sin(ang)*dist,
        ty: py + fy*Math.cos(ang)*dist + ry*Math.sin(ang)*dist
      };
      tRound = 0; armed = false;
      hud.set('round', (idx+1) + ' / ' + ROUNDS);
    }

    function answer(dir){                                /* -1 left, 1 right */
      if(!running || !q || flash) return;
      var right = (dir === q.side);
      if(right) correct++;
      times.push(tRound);
      flash = right ? 'ok' : 'no';
      flashT = 0;
      hud.set('ok', String(correct));
      hud.set('fast', fmt1(tRound) + 's', right ? 'good' : 'bad');
    }

    function nextOrEnd(){
      idx++;
      if(idx >= ROUNDS){
        running = false;
        var acc = correct / ROUNDS;
        var mean = times.reduce(function(a,b){return a+b;},0) / Math.max(1,times.length);
        /* accuracy is most of it; a speed bonus for being under two seconds */
        var base = acc * 88;
        var bonus = clamp((2.6 - mean) / 1.6, 0, 1) * 12;
        var score = Math.round(clamp(base + bonus, 0, 100));
        showOver(stage, {
          title: correct === ROUNDS ? 'All ten' : correct + ' of ' + ROUNDS,
          cls: score >= 80 ? 'win' : 'lose', big:score,
          sub:'Average ' + fmt1(mean) + ' s per answer. Accuracy is 88 of the score and speed the other 12 - because knowing it slowly isn\'t the same as knowing it.',
          buttons:[
            { label:'Finish lesson', cls:'go', onClick:function(){
                ctx.finish(score, { orientCorrect:correct, orientRounds:ROUNDS, meanSec:Math.round(mean*100)/100 });
              } },
            { label:'Ten more', onClick:function(){ idx=0; correct=0; times=[]; running=true; newRound(); hideOver(stage); } }
          ]
        });
      } else {
        newRound();
      }
    }

    function onKey(e){
      if(e.key === 'ArrowLeft')  answer(-1);
      if(e.key === 'ArrowRight') answer(1);
    }
    window.addEventListener('keydown', onKey);

    newRound();

    var loop = makeLoop(function(dt){
      hud.showSource();
      if(running && !flash){
        tRound += dt;
        /* the stick can answer too, once it has been returned to center */
        var a = GSInput.axes();
        if(Math.abs(a.roll) < 0.2) armed = true;
        if(armed && a.roll < -0.55) answer(-1);
        if(armed && a.roll >  0.55) answer(1);
      }
      if(flash){
        flashT += dt;
        if(flashT > 0.72){ flash = null; nextOrEnd(); }
      }

      if(overlayOn(stage)) return;          /* nothing visible behind it */
      gridBg(g, stage.W, stage.H);
      drawPilot(g, stage.W/2, stage.H - 34);
      if(q){
        /* sight line from you to the aircraft */
        g.strokeStyle = 'rgba(31,51,80,.16)'; g.lineWidth = 1.4; g.setLineDash([4,6]);
        g.beginPath(); g.moveTo(stage.W/2, stage.H-34); g.lineTo(q.dx, q.dy); g.stroke();
        g.setLineDash([]);
        /* the flag */
        g.strokeStyle = GREEN; g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(q.tx, q.ty+16); g.lineTo(q.tx, q.ty-18); g.stroke();
        g.fillStyle = GREEN;
        g.beginPath(); g.moveTo(q.tx, q.ty-18); g.lineTo(q.tx+24, q.ty-11); g.lineTo(q.tx, q.ty-4); g.closePath(); g.fill();
        label(g, q.tx + 6, q.ty + 32, 'TARGET', GREEN, 11);
        drawQuadTop(g, q.dx, q.dy, q.head, 1.25, flash === 'ok' ? GREEN : (flash === 'no' ? RUST : RUST));
      }
      /* the question */
      if(!flash){
        label(g, stage.W/2, 46, 'WHICH ROLL INPUT MOVES IT TO THE FLAG?', INKS, 13, 'center');
        g.fillStyle = INK; g.font = '600 25px "Barlow", sans-serif'; g.textAlign = 'center';
        g.fillText('←  LEFT          RIGHT  →', stage.W/2, stage.H - 74);
      } else {
        g.fillStyle = flash === 'ok' ? GREEN : RUST;
        g.font = '46px "Cabin Sketch", cursive'; g.textAlign = 'center';
        g.fillText(flash === 'ok' ? 'YES' : 'NO', stage.W/2, stage.H - 70);
        if(flash === 'no'){
          label(g, stage.W/2, stage.H - 44,
            'nose was pointing ' + (Math.cos(q.head) < -0.25 ? 'back at you - inputs reversed' : 'away or across - watch the nose marker'),
            RUST, 13, 'center');
        }
      }
    });

    running = true;
    return { stop:function(){ loop.stop(); stage.teardown(); window.removeEventListener('keydown', onKey); } };
  }

  /* ======================================================================
     gs-los-02 - GATE RUN
     Top-down. Six gates, ordered so the lap can\'t be flown nose-away.
     ====================================================================== */
  function gates(root, ctx){
    var PAR = 42;      /* seconds; over this costs a point each */
    var LIMIT = 90;

    var wrap = h('div','drill'); root.appendChild(wrap);
    var sv = makeSticks();
    brief(wrap, 'Gate Run',
      'Six gates, in order, from the correct side. Pitch and roll move it, yaw turns it. <b>Twelve points a gate</b>, less five for every post you clip and one for every second over ' + PAR + '.',
      sv.el);

    var hud = makeHud(wrap, [
      { id:'gate', k:'Next gate', v:'1 / 6' },
      { id:'time', k:'Clock', v:'0.0' },
      { id:'hits', k:'Contacts', v:'0' },
      { id:'spd',  k:'Speed', v:'0' }
    ]);
    var stage = makeStage(wrap, 1000, 560);
    var g = stage.g;

    /* Gates: x,y in canvas units, ang = the heading you must be travelling.
       Deliberately mixed so gates 3 and 5 are taken with the nose swung back
       toward the pilot. */
    var GATES = [
      { x:250, y:400, ang: -Math.PI/2,      w:58 },
      { x:250, y:170, ang: 0,               w:58 },
      { x:560, y:120, ang:  Math.PI/2 + .5, w:62 },
      { x:790, y:300, ang:  Math.PI/2,      w:58 },
      { x:600, y:430, ang:  Math.PI,        w:62 },
      { x:400, y:300, ang: -Math.PI/2 - .4, w:66 }
    ];

    var running = false, t = 0, next = 0, hits = 0, st, prevSide = [], trail = [];

    function reset(){
      st = { x:130, y:490, head:-Math.PI/2, vx:0, vy:0 };
      t = 0; next = 0; hits = 0; trail = [];
      prevSide = GATES.map(function(){ return null; });
    }
    function start(){ reset(); running = true; hideOver(stage); ctx.hint('Gates in order. If you get lost: center the sticks and yaw slowly.'); }

    function end(reason){
      running = false;
      var cleared = next;
      var over = Math.max(0, t - PAR);
      var score = clamp(Math.round(cleared*12 + (cleared===GATES.length ? 28 : 0) - hits*5 - over), 0, 100);
      showOver(stage, {
        title: cleared === GATES.length ? 'Lap complete' : 'Run ended',
        cls: cleared === GATES.length ? 'win' : 'lose',
        big:score,
        sub: cleared + ' of ' + GATES.length + ' gates, ' + hits + ' contact' + (hits===1?'':'s') +
             ', ' + fmt1(t) + ' s' + (over > 0 ? ' (' + Math.round(over) + ' over par)' : '') +
             (reason ? '. ' + reason : ''),
        buttons:[
          { label:'Finish lesson', cls:'go', onClick:function(){
              ctx.finish(score, { gatesCleared:cleared, contacts:hits, lapSec:Math.round(t*10)/10 });
            } },
          { label:'Fly it again', onClick:start }
        ]
      });
    }

    reset();

    var loop = makeLoop(function(dt){
      var a = GSInput.axes();
      sv.update(a);
      hud.showSource();

      if(running){
        t += dt;
        st.head += a.yaw * 2.3 * dt;
        var fx =  Math.sin(st.head), fy = -Math.cos(st.head);
        var rx =  Math.cos(st.head), ry =  Math.sin(st.head);
        var ACC = 340;
        st.vx += (fx*a.pitch + rx*a.roll) * ACC * dt;
        st.vy += (fy*a.pitch + ry*a.roll) * ACC * dt;
        st.vx -= st.vx * 1.5 * dt;
        st.vy -= st.vy * 1.5 * dt;
        st.x  += st.vx * dt;
        st.y  += st.vy * dt;
        st.x = clamp(st.x, 20, stage.W-20);
        st.y = clamp(st.y, 20, stage.H-20);

        trail.push({x:st.x,y:st.y});
        if(trail.length > 420) trail.shift();

        /* gate crossing: which side of the gate plane are we on */
        /* Gate crossing. `gi` is captured BEFORE next++ so the side history is
           written back against the gate it was measured for - writing it after
           the increment stamps the next gate with this gate's geometry and it
           can never be crossed. */
        var gi = next, G = GATES[gi];
        if(G){
          var nx = Math.sin(G.ang), ny = -Math.cos(G.ang);       /* gate normal */
          var side = (st.x - G.x)*nx + (st.y - G.y)*ny;
          var lat  = (st.x - G.x)*(-ny) + (st.y - G.y)*(nx);     /* along the gate */
          if(prevSide[gi] != null && prevSide[gi] < 0 && side >= 0 && Math.abs(lat) < G.w){
            if(Math.abs(lat) > G.w * 0.84) hits++;
            next++;
            if(next >= GATES.length) end('Clean finish.');
          }
          prevSide[gi] = side;
        }

        hud.set('gate', Math.min(next+1, GATES.length) + ' / ' + GATES.length);
        hud.set('time', fmt1(t), t > PAR ? 'warn' : '');
        hud.set('hits', String(hits), hits ? 'bad' : '');
        hud.set('spd', String(Math.round(Math.sqrt(st.vx*st.vx + st.vy*st.vy))));
        if(t > LIMIT) end('Out of time.');
      }

      /* ---- draw ---- */
      if(overlayOn(stage)) return;          /* nothing visible behind it */
      gridBg(g, stage.W, stage.H);
      /* gates */
      GATES.forEach(function(G,i){
        var done = i < next, isNext = i === next;
        var nx = Math.sin(G.ang), ny = -Math.cos(G.ang);
        var ax = -ny, ay = nx;
        var col = done ? 'rgba(45,106,62,.55)' : (isNext ? RUST : 'rgba(31,51,80,.34)');
        g.strokeStyle = col; g.lineWidth = isNext ? 5 : 3.4;
        g.beginPath();
        g.moveTo(G.x + ax*G.w, G.y + ay*G.w);
        g.lineTo(G.x + ax*(G.w-16), G.y + ay*(G.w-16));
        g.moveTo(G.x - ax*G.w, G.y - ay*G.w);
        g.lineTo(G.x - ax*(G.w-16), G.y - ay*(G.w-16));
        g.stroke();
        /* the opening */
        g.strokeStyle = done ? 'rgba(45,106,62,.28)' : (isNext ? 'rgba(143,61,18,.34)' : 'rgba(31,51,80,.14)');
        g.lineWidth = 1.6; g.setLineDash([5,6]);
        g.beginPath();
        g.moveTo(G.x + ax*(G.w-16), G.y + ay*(G.w-16));
        g.lineTo(G.x - ax*(G.w-16), G.y - ay*(G.w-16));
        g.stroke();
        g.setLineDash([]);
        /* direction of travel */
        if(isNext){
          g.strokeStyle = RUST; g.lineWidth = 2.2;
          g.beginPath();
          g.moveTo(G.x - nx*22, G.y - ny*22);
          g.lineTo(G.x + nx*24, G.y + ny*24);
          g.stroke();
          g.beginPath();
          g.moveTo(G.x + nx*24, G.y + ny*24);
          g.lineTo(G.x + nx*15 - ax*7, G.y + ny*15 - ay*7);
          g.moveTo(G.x + nx*24, G.y + ny*24);
          g.lineTo(G.x + nx*15 + ax*7, G.y + ny*15 + ay*7);
          g.stroke();
        }
        label(g, G.x + ax*(G.w+14), G.y + ay*(G.w+14) + 4,
              String(i+1), done ? GREEN : (isNext ? RUST : INKS), 15, 'center');
      });

      /* trail */
      g.strokeStyle = 'rgba(31,51,80,.22)'; g.lineWidth = 1.8;
      g.beginPath();
      trail.forEach(function(p,i){ if(i===0) g.moveTo(p.x,p.y); else g.lineTo(p.x,p.y); });
      g.stroke();

      drawPilot(g, stage.W/2, stage.H - 22);
      drawQuadTop(g, st.x, st.y, st.head, 1.15);
    });

    showOver(stage, {
      title:'Six gates',
      sub:'Take them in order, in the direction of the arrow. Gates 3 and 6 will have the nose swung back toward you - that\'s the point of the course.',
      buttons:[{ label:'Start', cls:'go', onClick:start }],
      keyhint:'arrows pitch and roll, A and D yaw'
    });
    return { stop:function(){ loop.stop(); stage.teardown(); } };
  }

  /* ======================================================================
     gs-los-03 - LOST ORIENTATION RECOVERY
     LEVEL, HOLD, YAW, GO - in that order, then land on the pad.
     ====================================================================== */
  function recover(root, ctx){
    var wrap = h('div','drill'); root.appendChild(wrap);

    var stepsEl = h('div','steps');
    var STEPS = [
      { k:'LEVEL', d:'Center pitch and roll' },
      { k:'HOLD',  d:'Steady throttle, gain a little height' },
      { k:'YAW',   d:'Turn until the nose points away' },
      { k:'GO',    d:'Fly to the pad and land' }
    ];
    var stepDivs = STEPS.map(function(s){
      var d = h('div','step');
      d.appendChild(h('span','n', s.k));
      d.appendChild(h('span','d', s.d));
      stepsEl.appendChild(d);
      return d;
    });

    brief(wrap, 'Recovery, in order',
      'You have been dropped in confused and drifting. Run the four steps <b>in sequence</b> - skipping one doesn\'t count - and then put it on the pad. Jumping straight to GO is exactly the habit this drill exists to break.',
      stepsEl);

    var hud = makeHud(wrap, [
      { id:'step', k:'Step', v:'LEVEL' },
      { id:'time', k:'Clock', v:'0.0' },
      { id:'nose', k:'Nose', v:'-' },
      { id:'alt',  k:'Height', v:'-' }
    ]);
    var stage = makeStage(wrap, 1000, 520);
    var g = stage.g;

    var running = false, t = 0, step = 0, hold = 0, st, landed = false, panic = 0;

    function reset(){
      st = {
        x: 240 + Math.random()*520, y: 120 + Math.random()*160,
        head: Math.random()*Math.PI*2,
        vx: (Math.random()-0.5)*130, vy: (Math.random()-0.5)*130,
        alt: 3.4
      };
      /* start it pointing somewhere confusing - never already away */
      if(Math.abs(st.head) < 0.9 || Math.abs(st.head - Math.PI*2) < 0.9) st.head += 2.2;
      t = 0; step = 0; hold = 0; landed = false; panic = 0;
      GSInput.presetThrottle(0.5);
    }
    var PAD = { x:500, y:430, r:40 };

    function start(){ reset(); running = true; hideOver(stage); ctx.hint('LEVEL first. Center the sticks and stop making it worse.'); }

    function end(ok, why){
      running = false;
      var score;
      if(ok) score = clamp(Math.round(100 - panic*9 - Math.max(0, t - 26)), 40, 100);
      else   score = clamp(Math.round(step * 16 - panic*8), 0, 60);
      showOver(stage, {
        title: ok ? 'Recovered' : 'Lost it',
        cls: ok ? 'win' : 'lose', big:score,
        sub:(ok
            ? 'Four steps, in order, and down on the pad in ' + fmt1(t) + ' s. '
            : (why || 'The procedure wasn\'t completed. ')) +
            (panic ? 'You made ' + panic + ' large input' + (panic===1?'':'s') + ' out of sequence - each one costs you, because that\'s the reflex that breaks aircraft.'
                   : 'No out-of-sequence inputs at all. That\'s the whole skill.'),
        buttons:[
          { label:'Finish lesson', cls:'go', onClick:function(){
              ctx.finish(score, { recovered:ok?1:0, panicInputs:panic, recoverSec:Math.round(t*10)/10 });
            } },
          { label:'Try again', onClick:start }
        ]
      });
    }

    /* How far the nose is from pointing away from the pilot (straight up the
       screen, heading 0). Must survive a heading that has been yawed several
       turns in either direction, so normalise into [0,2pi) first - a bare
       JS % returns a negative for a negative input. */
    function noseErr(){
      var TAU = Math.PI*2;
      var hd = st.head % TAU;
      if(hd < 0) hd += TAU;
      return hd > Math.PI ? (TAU - hd) : hd;
    }

    reset();

    var loop = makeLoop(function(dt){
      var a = GSInput.axes();
      hud.showSource();

      if(running && !landed){
        t += dt;

        /* physics: it drifts, and pitch/roll are body-frame */
        var fx =  Math.sin(st.head), fy = -Math.cos(st.head);
        var rx =  Math.cos(st.head), ry =  Math.sin(st.head);
        st.head += a.yaw * 1.9 * dt;
        var ACC = 300;
        st.vx += (fx*a.pitch + rx*a.roll) * ACC * dt;
        st.vy += (fy*a.pitch + ry*a.roll) * ACC * dt;
        st.vx -= st.vx * 1.25 * dt;
        st.vy -= st.vy * 1.25 * dt;
        st.x = clamp(st.x + st.vx*dt, 24, stage.W-24);
        st.y = clamp(st.y + st.vy*dt, 24, stage.H-24);
        st.alt += (a.thr - 0.5) * 4.2 * dt;
        st.alt = clamp(st.alt, 0, 12);

        var sticksCentred = Math.abs(a.pitch) < 0.18 && Math.abs(a.roll) < 0.18;
        var bigStick = Math.abs(a.pitch) > 0.6 || Math.abs(a.roll) > 0.6;

        /* an out-of-sequence stab is what the drill is really measuring */
        if(step < 3 && bigStick){
          panic += dt * 2.2;
        }

        if(step === 0){
          hold = sticksCentred ? hold + dt : 0;
          if(hold > 0.6){ step = 1; hold = 0; ctx.hint('HOLD. Steady throttle, gain a little height.'); }
        } else if(step === 1){
          var climbing = a.thr > 0.52 && a.thr < 0.9;
          hold = (climbing && sticksCentred) ? hold + dt : 0;
          if(hold > 0.9 && st.alt > 4.2){ step = 2; hold = 0; ctx.hint('YAW slowly until the nose points away from you.'); }
        } else if(step === 2){
          if(noseErr() < 0.42 && Math.abs(a.yaw) < 0.3){ hold += dt; } else { hold = 0; }
          if(hold > 0.55){ step = 3; hold = 0; ctx.hint('GO. Now fly to the pad and set it down.'); }
        } else if(step === 3){
          var d = Math.hypot(st.x - PAD.x, st.y - PAD.y);
          var slow = Math.hypot(st.vx, st.vy) < 55;
          if(d < PAD.r && slow && st.alt < 1.2){
            landed = true;
            end(true);
          }
        }

        hud.set('step', STEPS[Math.min(step,3)].k, step >= 3 ? 'good' : 'warn');
        hud.set('time', fmt1(t));
        var ne = noseErr();
        hud.set('nose', Math.round(ne*57.3) + '°', ne < 0.42 ? 'good' : 'bad');
        hud.set('alt', fmt1(st.alt) + ' m', st.alt > 4.2 ? 'good' : '');

        stepDivs.forEach(function(d,i){
          var cn = 'step' + (i < step ? ' ok' : (i === step ? ' now' : ''));
          if(d._cn === cn) return;            /* four writes a frame otherwise */
          d._cn = cn;
          d.className = cn;
        });

        if(t > 75) end(false, 'Ran out of time. ');
      }

      /* ---- draw ---- */
      if(overlayOn(stage)) return;          /* nothing visible behind it */
      gridBg(g, stage.W, stage.H);

      /* the pad */
      g.strokeStyle = (step >= 3) ? GREEN : 'rgba(31,51,80,.26)';
      g.lineWidth = 2.6; g.setLineDash([6,5]);
      g.beginPath(); g.arc(PAD.x, PAD.y, PAD.r, 0, 6.2832); g.stroke();
      g.setLineDash([]);
      label(g, PAD.x, PAD.y + 5, 'PAD', step >= 3 ? GREEN : INKS, 13, 'center');

      /* "away" reference */
      g.strokeStyle = 'rgba(84,104,129,.30)'; g.lineWidth = 1.4; g.setLineDash([4,7]);
      g.beginPath(); g.moveTo(stage.W/2, stage.H-24); g.lineTo(stage.W/2, 30); g.stroke();
      g.setLineDash([]);
      label(g, stage.W/2 + 8, 42, 'AWAY FROM YOU', INKS, 10);

      drawPilot(g, stage.W/2, stage.H - 22);
      drawQuadTop(g, st.x, st.y, st.head, 1.2,
        noseErr() < 0.42 ? GREEN : RUST);

      /* height ladder */
      var lx = stage.W - 40, ly0 = 70, ly1 = stage.H - 90;
      g.strokeStyle = INKS; g.lineWidth = 1.4;
      g.strokeRect(lx-10, ly0, 20, ly1-ly0);
      g.fillStyle = st.alt > 4.2 ? GREEN : AMBER;
      var hh = (ly1-ly0) * clamp(st.alt/12,0,1);
      g.fillRect(lx-10, ly1 - hh, 20, hh);
      /* the 4.2 m mark HOLD needs */
      var my = ly1 - (ly1-ly0)*(4.2/12);
      g.strokeStyle = RUST; g.lineWidth = 2;
      g.beginPath(); g.moveTo(lx-15, my); g.lineTo(lx+15, my); g.stroke();
      label(g, lx, ly0 - 10, 'ALT', INKS, 10, 'center');
    });

    showOver(stage, {
      title:'You\'re disoriented',
      sub:'It\'s drifting and the nose isn\'t where you think. Run LEVEL, HOLD, YAW, GO in that order. Big stick inputs before you reach GO count against you.',
      buttons:[{ label:'Start', cls:'go', onClick:start }],
      keyhint:'arrows pitch and roll, A and D yaw, W and S throttle'
    });
    return { stop:function(){ loop.stop(); stage.teardown(); } };
  }

  /* ====================================================================== */
  return {
    sticks:sticks, rateAngle:rateAngle, hover:hover, throttle:throttle,
    orient:orient, gates:gates, recover:recover,
    /* shared with gs-panels.js and gs-app.js */
    _h:h, _stage:makeStage, _hud:makeHud, _loop:makeLoop,
    _over:showOver, _hideOver:hideOver, _brief:brief, _clamp:clamp, _fmt1:fmt1
  };
})();
