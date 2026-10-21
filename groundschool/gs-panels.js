/* ===========================================================================
   FPV GROUND SCHOOL - PANEL DRILLS AND INLINE WIDGETS
   ---------------------------------------------------------------------------
   Two groups.

   GSPanels   the drills that aren\'t flight simulations - go/no-go sorting,
              the motor picker, battery arithmetic, channel assignment. Same
              contract as GSDrills: (root, ctx, opt) -> { stop() }.

   GSWidgets  the interactive pieces embedded INSIDE reading lessons. These
              aren\'t scored and never call finish() - they exist because a
              slider teaches voltage sag and a paragraph doesn\'t. Contract:
              (root) -> { stop() }.
   =========================================================================== */

var GSPanels = (function(){

  var h = GSDrills._h, brief = GSDrills._brief, clamp = GSDrills._clamp;

  function shuffle(a){
    a = a.slice();
    for(var i=a.length-1;i>0;i--){
      var j = Math.floor(Math.random()*(i+1)), t = a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }

  /* A reusable "one question at a time" runner. items is an array of
     { text, opts:[..], a:index, why } and it scores correct/total. */
  function runCards(root, ctx, cfg){
    var items = cfg.items, idx = 0, correct = 0, locked = false;
    var wrap = h('div','drill');
    root.appendChild(wrap);

    if(cfg.briefTitle) brief(wrap, cfg.briefTitle, cfg.briefBody);

    var hud = GSDrills._hud(wrap, [
      { id:'n',  k:cfg.unit || 'Card', v:'1 / ' + items.length },
      { id:'ok', k:'Correct', v:'0' }
    ]);
    hud.el.style.marginBottom = '18px';

    var area = h('div');
    wrap.appendChild(area);

    function draw(){
      var it = items[idx];
      hud.set('n', (idx+1) + ' / ' + items.length);
      hud.set('ok', String(correct));
      hud.showSource();
      area.innerHTML = '';

      var box = h('div','scen');
      box.appendChild(h('div','sn', (cfg.unit || 'CARD') + ' ' + (idx+1)));
      box.appendChild(h('div','st', it.text));
      area.appendChild(box);

      var btns = h('div','sortbtns');
      it.opts.forEach(function(o,i){
        var b = h('button','minibtn big', o);
        b.onclick = function(){ answer(i, btns); };
        btns.appendChild(b);
      });
      area.appendChild(btns);
      locked = false;
    }

    function answer(i, btns){
      if(locked) return;
      locked = true;
      var it = items[idx];
      var right = (i === it.a);
      if(right) correct++;
      hud.set('ok', String(correct));

      var kids = btns.children;
      for(var k=0;k<kids.length;k++){
        kids[k].disabled = true;
        if(k === it.a) kids[k].className = 'minibtn big go';
        else if(k === i) kids[k].className = 'minibtn big danger';
        else kids[k].style.opacity = '.58';
      }

      var why = h('div','why' + (right ? ' ok' : ''),
        '<b>' + (right ? 'Correct' : 'Not this time') + '</b>' + it.why);
      why.style.maxWidth = '720px';
      why.style.margin = '18px auto 0';
      area.appendChild(why);

      var nx = h('div','');
      nx.style.cssText = 'display:flex;justify-content:center;margin-top:18px';
      var b = h('button','minibtn big go', idx === items.length-1 ? 'See result' : 'Next');
      b.onclick = next;
      nx.appendChild(b);
      area.appendChild(nx);
      b.focus();
    }

    function next(){
      idx++;
      if(idx >= items.length) finishUp(); else draw();
    }

    function finishUp(){
      var score = Math.round(correct / items.length * 100);
      area.innerHTML = '';
      var card = h('div','scorecard');
      card.appendChild(h('div','bigscore ' + (score >= (cfg.pass||67) ? 'pass' : 'fail'), String(score)));
      card.appendChild(h('div','verdict ' + (score >= (cfg.pass||67) ? 'pass' : 'fail'),
        correct + ' of ' + items.length + ' right'));
      var p = h('p','', cfg.outro || '');
      p.style.cssText = 'margin-top:16px;font-weight:400;font-size:17px;line-height:1.55;color:var(--ink)';
      card.appendChild(p);
      var bs = h('div','');
      bs.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:22px;flex-wrap:wrap';
      var f = h('button','minibtn big go','Finish lesson');
      f.onclick = function(){ ctx.finish(score, cfg.extra ? cfg.extra(correct, items.length) : {}); };
      var r = h('button','minibtn big','Try again');
      r.onclick = function(){
        idx = 0; correct = 0;
        if(cfg.regenerate) items = cfg.regenerate();
        else items = shuffle(items);
        draw();
      };
      bs.appendChild(f); bs.appendChild(r);
      card.appendChild(bs);
      area.appendChild(card);
    }

    draw();
    return { stop:function(){} };
  }

  /* ======================================================================
     gs-rul-03 - GO / NO-GO
     ====================================================================== */
  /* TWO PILES, FIVE CARDS, BLACK AND WHITE (Micah, 2026-10-10).
     Three piles (fly / not yet / no fly) were too ambiguous - a swollen pack
     is "no fly" for that pack but "not yet" for the session - so it\'s now
     FLY or NOT YET, and every card has one clear answer. Any wind is "not
     yet". Five cards a run: two FLY and three NOT YET, shuffled. */
  var SCENARIOS = [
    { text:'One pack in the bag is visibly swollen. The shrink wrap is tight and domed.',
      a:1, why:'That pack never flies again - swap to a good one, then go. A puffed cell has already vented gas inside itself.' },
    { text:'The flags on the field are moving in a steady breeze.',
      a:1, why:'A steady breeze is "not yet" for a whoop. Wait for it to drop, or ask a mentor whether it\'s fine for what you\'re flying.' },
    { text:'Two others are already flying on Raceband R1 and R5. You\'re set to R8.',
      a:0, why:'R8 is 5917 MHz, R5 is 5806 and R1 is 5658 - your nearest neighbor is 111 MHz away, which is plenty. Go.' },
    { text:'Your pack is charged, the props are clean, your spotter is ready and the area is clear.',
      a:0, why:'Nothing to change. Part of pre-flight is being able to say "this is fine" and mean it. Call TAKEOFF and go.' },
    { text:'Indoors, calm air, a full pack, and your spotter has just said the room is clear.',
      a:0, why:'Everything is in place. Fly.' },
    { text:'One prop has a small nick out of the trailing edge.',
      a:1, why:'Swap it - two minutes - rather than fly a vibration into your gyro. Then go.' },
    { text:'Somebody is walking a dog across the flying area.',
      a:1, why:'Wait until they\'re out of the area. You don\'t fly over people, and you land if somebody walks in.' },
    { text:'Another pilot has just landed and is walking out to collect their quad.',
      a:1, why:'Nobody flies while somebody is out there. Wait for them to come back, then go.' },
    { text:'An aircraft you don\'t recognize is circling low over the field.',
      a:1, why:'Crewed aircraft always get the air. Wait on the ground until it has gone.' },
    { text:'Your goggles have fogged and you can make out maybe half the picture.',
      a:1, why:'Wipe them, then go. Flying on half a picture is how people fly into whatever was in the other half.' },
    { text:'You\'re in goggles and your spotter has just left.',
      a:1, why:'No spotter, no goggle flight. Wait until somebody else takes the job.' }
  ];
  function pickFive(){
    var fly = shuffle(SCENARIOS.filter(function(s){ return s.a === 0; })).slice(0, 2);
    var wait = shuffle(SCENARIOS.filter(function(s){ return s.a === 1; })).slice(0, 3);
    return shuffle(fly.concat(wait)).map(function(s){
      return { text:s.text, opts:['Fly','Not yet'], a:s.a, why:' ' + s.why };
    });
  }

  function goNoGo(root, ctx){
    var run = runCards(root, ctx, {
      briefTitle:'Fly, or not yet?',
      briefBody:'Five things that could happen before a flight. Each one goes in one pile. <b>FLY</b> &mdash; nothing needs to change, go. <b>NOT YET</b> &mdash; one thing changes first: swap a part, wait for the wind or for the area to clear.',
      unit:'SCENARIO',
      items: pickFive(),
      pass:80,
      outro:'The mistake is almost never putting something in the wrong pile. It\'s not sorting at all, and flying because the pack is charged and everyone is waiting.',
      regenerate:pickFive,
      extra:function(c,t){ return { scenariosRight:c, scenariosTotal:t }; }
    });
    var d = root.querySelector('.drill'); if(d) d.classList.add('bw');
    return run;
  }

  /* ======================================================================
     gs-ele-02 - MOTOR PICKER
     The spin directions are drawn on the diagram, so every answer is
     derivable rather than memorized.
     ====================================================================== */
  function motors(root, ctx){
    /* Layout, viewed from above, Betaflight numbering:
         1 rear-right   2 front-right   3 rear-left   4 front-left
       Spin, as DRAWN on the diagram:
         2 and 3 clockwise, 1 and 4 counterclockwise.
       A prop pushes the airframe the opposite way to its own rotation, so
       speeding up the counterclockwise pair (1,4) yaws the airframe
       clockwise - to the right. */
    var POS = {
      1:{ x:206, y:206, spin:'ccw' },
      2:{ x:206, y:94,  spin:'cw'  },
      3:{ x:94,  y:206, spin:'cw'  },
      4:{ x:94,  y:94,  spin:'ccw' }
    };
    var ROUNDS = [
      { ask:'CLIMB',         want:[1,2,3,4], why:'All four faster. Nothing tilts, it just goes up.' },
      { ask:'ROLL RIGHT',    want:[3,4],     why:'More thrust on the LEFT side tips it to the right. Motors 3 and 4 are the left pair.' },
      { ask:'ROLL LEFT',     want:[1,2],     why:'More thrust on the right side tips it to the left. Motors 1 and 2 are the right pair.' },
      { ask:'PITCH FORWARD', want:[1,3],     why:'More thrust at the BACK tips the nose down and it moves forward. Motors 1 and 3 are the rear pair.' },
      { ask:'PITCH BACK',    want:[2,4],     why:'More thrust at the front tips the nose up and it moves backward. Motors 2 and 4 are the front pair.' },
      { ask:'YAW RIGHT',     want:[1,4],     why:'A prop pushes the airframe the opposite way to its own spin. 1 and 4 turn counterclockwise on the diagram, so speeding them up twists the airframe clockwise - to the right.' },
      { ask:'YAW LEFT',      want:[2,3],     why:'2 and 3 turn clockwise, so speeding them up twists the airframe counterclockwise - to the left.' }
    ];

    var order = shuffle(ROUNDS), idx = 0, correct = 0, sel = {}, locked = false;

    var wrap = h('div','drill'); root.appendChild(wrap);
    brief(wrap, 'Which motors speed up?',
      'Click every motor that spins <b>faster</b> for the movement asked for, then check it. The spin direction of each motor is drawn on the diagram - you should never have to guess.');

    var hud = GSDrills._hud(wrap, [
      { id:'n',  k:'Round', v:'1 / ' + order.length },
      { id:'ok', k:'Correct', v:'0' },
      { id:'ask',k:'Do this', v:'-' }
    ]);
    var area = h('div'); wrap.appendChild(area);

    function svg(){
      var s = '<svg viewBox="0 0 300 300" class="mtarget">';
      s += '<g stroke="var(--ink)" stroke-width="3" fill="none">' +
           '<path d="M94 94 L206 206 M206 94 L94 206"/>' +
           '<rect x="126" y="126" width="48" height="48" rx="3" fill="var(--paper-2)"/></g>';
      /* nose */
      s += '<path d="M150 126 L150 54" stroke="var(--rust)" stroke-width="2.6" stroke-dasharray="6 4"/>' +
           '<path d="M141 66 L150 50 L159 66" fill="none" stroke="var(--rust)" stroke-width="2.6"/>' +
           '<text x="150" y="40" text-anchor="middle" font-family="var(--font-mono)" font-size="13" fill="var(--rust)" letter-spacing="2">NOSE</text>';
      for(var n=1;n<=4;n++){
        var p = POS[n];
        var cls = sel[n] ? 'sel' : '';
        s += '<circle class="' + cls + '" data-m="' + n + '" cx="' + p.x + '" cy="' + p.y +
             '" r="30" fill="' + (sel[n] ? 'var(--amber)' : 'var(--paper)') +
             '" stroke="var(--ink)" stroke-width="2.4"/>';
        s += '<text x="' + p.x + '" y="' + (p.y+6) + '" text-anchor="middle" pointer-events="none" ' +
             'font-family="var(--font-mono)" font-size="17" fill="' + (sel[n] ? '#fff' : 'var(--ink)') + '">' + n + '</text>';
        /* spin arrow, drawn outside the motor */
        var r = 40, sweep = (p.spin === 'cw') ? 1 : 0;
        var a0 = (p.x < 150 ? Math.PI : 0) + (p.y < 150 ? -0.9 : 0.9);
        var a1 = a0 + (p.spin === 'cw' ? 1.5 : -1.5);
        var x0 = p.x + Math.cos(a0)*r, y0 = p.y + Math.sin(a0)*r;
        var x1 = p.x + Math.cos(a1)*r, y1 = p.y + Math.sin(a1)*r;
        s += '<path d="M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' A' + r + ' ' + r + ' 0 0 ' + sweep +
             ' ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + '" fill="none" stroke="var(--sky)" stroke-width="2.2"/>';
        var ah = a1 + (p.spin === 'cw' ? -0.30 : 0.30);
        s += '<path d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' L' +
             (p.x + Math.cos(ah)*(r-8)).toFixed(1) + ' ' + (p.y + Math.sin(ah)*(r-8)).toFixed(1) + ' M' +
             x1.toFixed(1) + ' ' + y1.toFixed(1) + ' L' +
             (p.x + Math.cos(ah)*(r+8)).toFixed(1) + ' ' + (p.y + Math.sin(ah)*(r+8)).toFixed(1) +
             '" fill="none" stroke="var(--sky)" stroke-width="2.2"/>';
      }
      s += '<text x="150" y="290" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--sky)">blue arrows = which way that prop turns</text>';
      s += '</svg>';
      return s;
    }

    function draw(){
      var R = order[idx];
      hud.set('n', (idx+1) + ' / ' + order.length);
      hud.set('ok', String(correct));
      hud.set('ask', R.ask, 'warn');
      hud.showSource();
      area.innerHTML = '';

      var pick = h('div','quadpick', svg());
      area.appendChild(pick);

      pick.querySelectorAll('circle[data-m]').forEach(function(c){
        c.style.cursor = 'pointer';
        c.addEventListener('click', function(){
          if(locked) return;
          var n = c.getAttribute('data-m');
          if(sel[n]) delete sel[n]; else sel[n] = true;
          draw();
        });
      });

      var bs = h('div','');
      bs.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:6px;flex-wrap:wrap';
      var chk = h('button','minibtn big go','Check');
      chk.onclick = check;
      var clr = h('button','minibtn big','Clear');
      clr.onclick = function(){ if(!locked){ sel = {}; draw(); } };
      bs.appendChild(clr); bs.appendChild(chk);
      area.appendChild(bs);
      locked = false;
    }

    function check(){
      if(locked) return;
      var R = order[idx];
      var got = Object.keys(sel).map(Number).sort().join(',');
      var want = R.want.slice().sort().join(',');
      var right = got === want;
      if(right) correct++;
      hud.set('ok', String(correct));
      locked = true;

      var why = h('div','why' + (right ? ' ok' : ''),
        '<b>' + (right ? 'Correct' : 'The answer is ' + R.want.join(' and ')) + '</b> ' + R.why);
      why.style.cssText = 'max-width:720px;margin:16px auto 0';
      area.appendChild(why);

      var nx = h('div','');
      nx.style.cssText = 'display:flex;justify-content:center;margin-top:16px';
      var b = h('button','minibtn big go', idx === order.length-1 ? 'See result' : 'Next');
      b.onclick = function(){
        idx++; sel = {};
        if(idx >= order.length) result(); else draw();
      };
      nx.appendChild(b);
      area.appendChild(nx);
      b.focus();
    }

    function result(){
      var score = Math.round(correct / order.length * 100);
      area.innerHTML = '';
      var card = h('div','scorecard');
      card.appendChild(h('div','bigscore ' + (score>=70?'pass':'fail'), String(score)));
      card.appendChild(h('div','verdict ' + (score>=70?'pass':'fail'), correct + ' of ' + order.length + ' right'));
      var p = h('p','','Roll and pitch are about which SIDE gets more thrust. Yaw is the only one that needs the spin directions - and it\'s the one that catches everybody out.');
      p.style.cssText = 'margin-top:16px;font-weight:400;font-size:17px;line-height:1.55;color:var(--ink)';
      card.appendChild(p);
      var bs = h('div',''); bs.style.cssText='display:flex;gap:12px;justify-content:center;margin-top:22px';
      var f = h('button','minibtn big go','Finish lesson');
      f.onclick = function(){ ctx.finish(score, { motorRounds:order.length, motorRight:correct }); };
      var r = h('button','minibtn big','Try again');
      r.onclick = function(){ order = shuffle(ROUNDS); idx=0; correct=0; sel={}; draw(); };
      bs.appendChild(f); bs.appendChild(r);
      card.appendChild(bs);
      area.appendChild(card);
    }

    draw();
    return { stop:function(){} };
  }

  /* ======================================================================
     gs-ele-04 - BATTERY MATH
     Numbers are generated, so there\'s nothing to memorize.
     ====================================================================== */
  function batteryMath(root, ctx){

    function makeItems(){
      var items = [];

      /* 1 - maximum current */
      (function(){
        var mah = pick([1100,1300,1500,1800,2200]);
        var c   = pick([45,55,75,95,100,120]);
        var ans = mah/1000*c;
        var opts = shuffle([
          ans, ans/10, ans*10, mah*c/100/2
        ].map(function(v){ return Math.round(v*10)/10; }));
        /* de-duplicate without losing the answer */
        var seen = {}, clean = [];
        opts.forEach(function(v){ if(!seen[v]){ seen[v]=1; clean.push(v); } });
        while(clean.length < 4){ clean.push(Math.round((ans*(1.5+clean.length))*10)/10); }
        items.push({
          text:'A ' + mah + ' mAh pack is rated ' + c + 'C. What is the most current it can deliver?',
          opts: clean.map(function(v){ return v + ' A'; }),
          a: clean.indexOf(Math.round(ans*10)/10),
          why:' mAh divided by 1000 gives amp-hours, then times C. ' + mah + ' / 1000 = ' +
              (mah/1000) + ' Ah, times ' + c + 'C = ' + (Math.round(ans*10)/10) + ' A.'
        });
      })();

      /* 2 - flight time at 80% depth of discharge */
      (function(){
        var mah  = pick([1300,1500,1800,2200,3000]);
        var draw = pick([12,15,18,22,28,35]);
        var mins = (mah/1000) * 0.8 / draw * 60;
        var ans  = Math.round(mins*10)/10;
        var clean = [ans,
                     Math.round(mins/0.8*10)/10,          /* forgot the reserve */
                     Math.round(mins*2*10)/10,
                     Math.round(mins/2*10)/10];
        var seen={}, out=[];
        clean.forEach(function(v){ if(!seen[v]){seen[v]=1;out.push(v);} });
        while(out.length<4) out.push(Math.round((ans+out.length*1.7)*10)/10);
        out = shuffle(out);
        items.push({
          text:'A ' + mah + ' mAh pack, average draw ' + draw + ' A, and you land with 20% left. Roughly how many minutes of flying?',
          opts: out.map(function(v){ return v + ' min'; }),
          a: out.indexOf(ans),
          why:' Usable capacity is 80% of ' + (mah/1000) + ' Ah = ' + (Math.round(mah/1000*0.8*100)/100) +
              ' Ah. Divide by ' + draw + ' A for hours, times 60 for minutes = ' + ans + ' min. Running a pack flat is how you kill it.'
        });
      })();

      /* 3 - pack choice for a peak draw.
         Built from the full grid of realistic mAh and C values rather than a
         short hand-written candidate list, because a fixed list can\'t
         guarantee one sufficient pack AND three insufficient ones for every
         value of `need` - at the low end there were only two packs weak
         enough, and the question rendered with two options. */
      (function(){
        var MAH = [450,650,850,1100,1300,1500,1800,2200,3000];
        var CR  = [25,35,45,50,60,75,95,100,120,130,150];
        var need = pick([70,85,90,110,130,160]);
        var cap = function(p){ return p.mah/1000*p.c; };

        var grid = [];
        MAH.forEach(function(m){ CR.forEach(function(c){ grid.push({mah:m,c:c}); }); });

        /* comfortably sufficient, but not absurdly oversized - a 3000 mAh 150C
           pack is a "right answer" nobody would ever actually fit */
        var ok  = grid.filter(function(p){ return cap(p) >= need*1.10 && cap(p) <= need*2.2; });
        var bad = grid.filter(function(p){ return cap(p) <= need*0.85; });

        var good = pick(ok.length ? ok : grid.filter(function(p){ return cap(p) >= need*1.10; }));

        /* three wrong answers with DISTINCT capabilities, so no two options are
           secretly the same amps */
        var seen = {}, wrong = [];
        shuffle(bad).forEach(function(p){
          var k = Math.round(cap(p));
          if(wrong.length < 3 && !seen[k]){ seen[k] = 1; wrong.push(p); }
        });

        var opts = shuffle([good].concat(wrong));
        items.push({
          text:'Your quad pulls about ' + need + ' A on a hard punch. Which pack can supply it?',
          opts: opts.map(function(p){ return p.mah + ' mAh, ' + p.c + 'C'; }),
          a: opts.indexOf(good),
          why:' ' + good.mah + ' mAh at ' + good.c + 'C gives ' + Math.round(cap(good)) +
              ' A, which covers ' + need + ' A. Every other option comes up short. Ask a pack for more ' +
              'than its C rating allows and it sags, gets hot, and puffs.'
        });
      })();

      return items;
    }

    return runCards(root, ctx, {
      briefTitle:'Three sums',
      briefBody:'The numbers are generated fresh every attempt, so there\'s nothing to learn by heart. Work them.',
      unit:'PROBLEM',
      items: makeItems(),
      regenerate: makeItems,
      pass:67,
      outro:'You\'ll do these three sums for as long as you fly. Usable capacity is 80% of the pack, maximum current is mAh over 1000 times C, and a pack asked for more than that doesn\'t last.',
      extra:function(c,t){ return { mathRight:c, mathTotal:t }; }
    });
  }

  /* ======================================================================
     gs-vid-02 - CHANNEL ASSIGNMENT
     Part A: pick a channel far enough from everyone already flying.
     Part B: three questions on power and the antenna rule.
     ====================================================================== */
  function channels(root, ctx){
    /* Real Raceband center frequencies, MHz. 37 MHz apart. */
    var R = [5658,5695,5732,5769,5806,5843,5880,5917];
    var GAP = 55;          /* leave a gap: adjacent is 37, so skip one */
    var ROUNDS = 5;

    var wrap = h('div','drill'); root.appendChild(wrap);
    brief(wrap, 'Pick a clear channel',
      'These are the eight Raceband channels and their real frequencies. Some are already in use. Pick one at least <b>' + GAP + ' MHz</b> clear of every pilot who is already up - adjacent Raceband channels are only 37 MHz apart, so you have to skip one.');

    var hud = GSDrills._hud(wrap, [
      { id:'n',  k:'Round', v:'1 / ' + ROUNDS },
      { id:'ok', k:'Clear picks', v:'0' }
    ]);
    var area = h('div'); wrap.appendChild(area);

    var idx = 0, correct = 0, taken = [], locked = false, phase = 'A', qCorrect = 0;

    function newRound(){
      var n = idx < 2 ? 1 : (idx < 4 ? 2 : 3);
      taken = shuffle(R).slice(0, n);
      /* guarantee at least one legal answer exists */
      var legal = R.filter(function(f){
        return taken.every(function(tf){ return Math.abs(f - tf) >= GAP; });
      });
      if(!legal.length){ return newRound(); }
      locked = false;
      draw();
    }

    function safeFor(f){
      return taken.every(function(tf){ return Math.abs(f - tf) >= GAP; });
    }

    function draw(){
      hud.set('n', (idx+1) + ' / ' + ROUNDS);
      hud.set('ok', String(correct));
      hud.showSource();
      area.innerHTML = '';

      var who = h('div','');
      who.style.cssText = 'text-align:center;margin-bottom:16px;font-family:var(--font-hand);font-size:22px;color:var(--rust)';
      who.textContent = taken.length === 1
        ? 'One pilot is already flying.'
        : taken.length + ' pilots are already flying.';
      area.appendChild(who);

      var grid = h('div','chgrid');
      R.forEach(function(f,i){
        var isTaken = taken.indexOf(f) >= 0;
        var cell = h('div','chcell' + (isTaken ? ' taken' : ''),
          'R' + (i+1) + '<small>' + f + '</small><small>' + (isTaken ? 'in use' : '&nbsp;') + '</small>');
        if(!isTaken){
          cell.onclick = function(){ answer(f, grid); };
        }
        grid.appendChild(cell);
      });
      area.appendChild(grid);
    }

    function answer(f, grid){
      if(locked) return;
      locked = true;
      var ok = safeFor(f);
      if(ok) correct++;
      hud.set('ok', String(correct));

      /* mark the grid up so the reason is visible, not just the verdict */
      var kids = grid.children;
      for(var i=0;i<R.length;i++){
        var freq = R[i], cell = kids[i];
        if(taken.indexOf(freq) >= 0) continue;
        var nearest = Math.min.apply(null, taken.map(function(tf){ return Math.abs(freq - tf); }));
        if(freq === f) cell.className = 'chcell ' + (ok ? 'pick' : 'bad');
        else if(nearest < GAP) cell.className = 'chcell adj';
        cell.lastChild.innerHTML = nearest + ' away';
      }

      var nearestPick = Math.min.apply(null, taken.map(function(tf){ return Math.abs(f - tf); }));
      var why = h('div','why' + (ok ? ' ok' : ''),
        '<b>' + (ok ? 'Clear' : 'Too close') + '</b> Your pick is ' + nearestPick +
        ' MHz from the nearest pilot. ' +
        (ok ? 'That\'s enough separation for both of you to keep a picture.'
            : 'Under ' + GAP + ' MHz and the two transmitters bleed into each other. Amber cells above are the ones that were also too close.'));
      why.style.cssText = 'max-width:720px;margin:18px auto 0';
      area.appendChild(why);

      var nx = h('div',''); nx.style.cssText='display:flex;justify-content:center;margin-top:16px';
      var b = h('button','minibtn big go', idx === ROUNDS-1 ? 'On to the questions' : 'Next');
      b.onclick = function(){
        idx++;
        if(idx >= ROUNDS) startB(); else newRound();
      };
      nx.appendChild(b);
      area.appendChild(nx);
      b.focus();
    }

    var QS = [
      { text:'You\'re about to power up a video transmitter and you notice the antenna isn\'t fitted. What happens if you plug the battery in?',
        opts:['Nothing, it just has no range','The transmitter cooks itself within seconds','It falls back to 25 mW','The goggles won\'t find it'],
        a:1, why:' With no antenna the output has nowhere to go, reflects back into the amplifier, and destroys it. Antenna first, battery second.' },
      { text:'Four of you want to fly at once. Which band and why?',
        opts:['Band A, it\'s the default','Raceband, its channels are spaced further apart','Whichever band has the lowest frequency','Any band, as long as the channels differ'],
        a:1, why:' The other bands pack their channels too close together to run four aircraft. Raceband exists precisely for this.' },
      { text:'Mid-flight your picture tears into a second, unfamiliar image. What has just happened, and what do you do?',
        opts:['Your VTX is failing - land','Somebody powered up on or near your channel - land and sort out channels on the ground','Your goggles lost diversity - switch antennas','You\'re at the edge of range - fly back'],
        a:1, why:' Two transmitters close in frequency destroy each other\'s picture. Neither of you can fly. Land, and assign channels out loud before anyone arms.' }
    ];

    function startB(){
      phase = 'B';
      var qi = 0;
      qCorrect = 0;

      function drawQ(){
        hud.set('n', 'Q' + (qi+1) + ' / ' + QS.length);
        hud.set('ok', String(correct) + ' + ' + qCorrect);
        area.innerHTML = '';
        var q = QS[qi];
        var box = h('div','qwrap');
        box.appendChild(h('div','qhead','QUESTION ' + (qi+1) + ' OF ' + QS.length));
        box.appendChild(h('div','qtext', q.text));
        var opts = h('div','opts');
        q.opts.forEach(function(o,i){
          var b = h('button','opt');
          b.appendChild(h('span','key', String.fromCharCode(65+i)));
          b.appendChild(h('span','', o));
          b.onclick = function(){ ansQ(i, opts, q); };
          opts.appendChild(b);
        });
        box.appendChild(opts);
        area.appendChild(box);
      }

      function ansQ(i, opts, q){
        var right = i === q.a;
        if(right) qCorrect++;
        hud.set('ok', String(correct) + ' + ' + qCorrect);
        var kids = opts.children;
        for(var k=0;k<kids.length;k++){
          kids[k].disabled = true;
          if(k === q.a) kids[k].className = 'opt right';
          else if(k === i) kids[k].className = 'opt wrong';
          else kids[k].className = 'opt dim';
        }
        var why = h('div','why' + (right ? ' ok' : ''),
          '<b>' + (right ? 'Correct' : 'Not this one') + '</b>' + q.why);
        opts.parentNode.appendChild(why);
        var nx = h('div',''); nx.style.cssText='display:flex;justify-content:center;margin-top:18px';
        var b = h('button','minibtn big go', qi === QS.length-1 ? 'See result' : 'Next');
        b.onclick = function(){ qi++; if(qi >= QS.length) result(); else drawQ(); };
        nx.appendChild(b);
        opts.parentNode.appendChild(nx);
        b.focus();
      }

      drawQ();
    }

    function result(){
      /* channel picking is 60 of the score, the questions the other 40 */
      var score = Math.round(correct/ROUNDS*60 + qCorrect/QS.length*40);
      area.innerHTML = '';
      var card = h('div','scorecard');
      card.appendChild(h('div','bigscore ' + (score>=70?'pass':'fail'), String(score)));
      card.appendChild(h('div','verdict ' + (score>=70?'pass':'fail'),
        correct + ' of ' + ROUNDS + ' clear picks, ' + qCorrect + ' of ' + QS.length + ' questions'));
      var p = h('p','','Channels get assigned on the ground, out loud, before anyone arms. Somebody is about to be blind if you get it wrong.');
      p.style.cssText='margin-top:16px;font-weight:400;font-size:17px;line-height:1.55;color:var(--ink)';
      card.appendChild(p);
      var bs = h('div',''); bs.style.cssText='display:flex;gap:12px;justify-content:center;margin-top:22px;flex-wrap:wrap';
      var f = h('button','minibtn big go','Finish lesson');
      f.onclick = function(){ ctx.finish(score, { chanClear:correct, chanRounds:ROUNDS, chanQuiz:qCorrect }); };
      var r = h('button','minibtn big','Try again');
      r.onclick = function(){ idx=0; correct=0; qCorrect=0; phase='A'; newRound(); };
      bs.appendChild(f); bs.appendChild(r);
      card.appendChild(bs);
      area.appendChild(card);
    }

    newRound();
    return { stop:function(){} };
  }

  return { goNoGo:goNoGo, motors:motors, batteryMath:batteryMath, channels:channels,
           _runCards:runCards, _shuffle:shuffle };
})();


/* ===========================================================================
   INLINE WIDGETS - the interactive pieces inside reading lessons.
   Not scored. Never call finish().
   =========================================================================== */
var GSWidgets = (function(){

  var h = GSDrills._h, clamp = GSDrills._clamp;

  /* ---------------------------------------------------------------------
     gs-ele-03 - the voltage slider, with a throttle punch that sags
     --------------------------------------------------------------------- */
  function voltage(root){
    var S = 4, per = 3.85, punch = 0, raf = 0;

    var w = h('div','vwrap');
    root.appendChild(w);

    var pickS = h('div','');
    pickS.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-bottom:16px';
    [2,3,4,6].forEach(function(n){
      var b = h('button','minibtn' + (n===S?' go':''), n + 'S');
      b.onclick = function(){ S = n; render(); };
      pickS.appendChild(b);
    });
    w.appendChild(pickS);

    var read  = h('div','vread');
    var vv    = h('span','vv','0.00');
    var vc    = h('span','vc','');
    read.appendChild(vv); read.appendChild(vc);
    w.appendChild(read);

    var state = h('div','vstate','');
    w.appendChild(state);

    var slider = document.createElement('input');
    slider.type = 'range'; slider.min = '300'; slider.max = '420'; slider.step = '1';
    slider.value = '385';
    slider.oninput = function(){ per = parseInt(slider.value,10)/100; render(); };
    w.appendChild(slider);

    var scale = h('div','');
    scale.style.cssText = 'display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10.5px;color:var(--ink-soft);letter-spacing:1.2px;margin-top:-2px';
    scale.innerHTML = '<span>3.00 DEAD</span><span>3.50 LAND</span><span>3.80 STORE</span><span>4.20 FULL</span>';
    w.appendChild(scale);

    var punchBtn = h('button','minibtn big warn','Punch the throttle');
    punchBtn.style.cssText = 'display:block;margin:20px auto 0';
    /* handler assigned below, once the decay loop exists */
    w.appendChild(punchBtn);

    var note = h('div','marginnote','');
    note.style.cssText = 'max-width:560px;margin:20px auto 0';
    w.appendChild(note);

    function classify(v){
      if(v >= 4.15) return { c:'s-full', t:'FULL - fly it, but don\'t store it here' };
      if(v >= 3.75) return { c:'s-good', t:'GOOD - fly, and this is storage territory too' };
      if(v >= 3.50) return { c:'s-land', t:'LAND NOW - it goes on the charger, not back up' };
      return          { c:'s-dead', t:'DAMAGE - every second below 3.00 costs capacity' };
    }

    function render(){
      var shown = clamp(per - punch * 0.55, 2.6, 4.2);
      var pack = shown * S;
      vv.textContent = pack.toFixed(2) + ' V';
      vc.textContent = shown.toFixed(2) + ' V per cell  ·  ' + S + 'S';
      var st = classify(shown);
      state.className = 'vstate ' + st.c;
      state.textContent = st.t;
      /* keep the S buttons in step */
      var bs = pickS.children;
      [2,3,4,6].forEach(function(n,i){ bs[i].className = 'minibtn' + (n===S?' go':''); });
      note.innerHTML = punch > 0.02
        ? 'That drop is <b>sag</b>, not damage. Let off and it comes back.'
        : 'Judge a pack on its <b>resting</b> voltage, thirty seconds after you land.';
    }

    /* The sag animation only exists while punch is decaying, which is a second
       or so after the button. It used to hold a requestAnimationFrame loop open
       for the whole lesson to watch a variable that\'s almost always 0, so the
       loop now starts on the punch and retires itself when the decay is done. */
    function tick(){
      if(punch > 0){
        punch = Math.max(0, punch - 0.02);
        render();
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    }
    function kick(){ if(!raf) raf = requestAnimationFrame(tick); }

    punchBtn.onclick = function(){ punch = 1; kick(); };

    render();
    return { stop:function(){ if(raf) cancelAnimationFrame(raf); raf = 0; } };
  }

  /* ---------------------------------------------------------------------
     gs-vid-01 - analog against digital, on one signal slider
     --------------------------------------------------------------------- */
  function signal(root){
    var sig = 0.9, raf = 0;
    var W = 340, H = 200;

    var w = h('div','');
    w.style.cssText = 'max-width:760px;margin:0 auto';
    root.appendChild(w);

    var row = h('div','');
    row.style.cssText = 'display:flex;gap:18px;justify-content:center;flex-wrap:wrap';
    function pane(title){
      var p = h('div','');
      p.style.cssText = 'text-align:center';
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      cv.style.cssText = 'width:100%;max-width:340px;height:auto;border:1.5px solid var(--line-hard);background:#000;display:block';
      p.appendChild(cv);
      var lbl = h('div','');
      lbl.style.cssText = 'font-family:var(--font-mono);font-size:11.5px;letter-spacing:2px;color:var(--ink-soft);margin-top:7px';
      lbl.textContent = title;
      p.appendChild(lbl);
      var st = h('div','');
      st.style.cssText = 'font-family:var(--font-hand);font-size:16px;color:var(--rust);margin-top:3px;min-height:22px';
      p.appendChild(st);
      row.appendChild(p);
      return { cv:cv, g:cv.getContext('2d'), st:st };
    }
    var A = pane('ANALOG'), D = pane('DIGITAL');
    w.appendChild(row);

    var slider = document.createElement('input');
    slider.type='range'; slider.min='0'; slider.max='100'; slider.value='90';
    slider.style.cssText = 'margin-top:22px';
    slider.oninput = function(){ sig = parseInt(slider.value,10)/100; };
    w.appendChild(slider);
    var cap = h('div','');
    cap.style.cssText = 'display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10.5px;color:var(--ink-soft);letter-spacing:1.4px';
    cap.innerHTML = '<span>FAR AWAY</span><span>SIGNAL STRENGTH</span><span>CLOSE IN</span>';
    w.appendChild(cap);

    /* the scene both panes render: a horizon, a gate, and a tree */
    function scene(g){
      g.fillStyle = '#2c4a63'; g.fillRect(0,0,W,H*0.55);
      g.fillStyle = '#4b5f3a'; g.fillRect(0,H*0.55,W,H*0.45);
      g.strokeStyle = '#c9d4b4'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(120,H*0.86); g.lineTo(120,H*0.40);
      g.moveTo(228,H*0.86); g.lineTo(228,H*0.40); g.stroke();
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(112,H*0.40); g.lineTo(236,H*0.40); g.stroke();
      g.fillStyle = '#2f3f27';
      g.beginPath(); g.moveTo(300,H*0.72); g.lineTo(286,H*0.44); g.lineTo(316,H*0.44); g.closePath(); g.fill();
      g.fillRect(297,H*0.70,7,20);
      /* a fake OSD, so the digital pane has something to lose */
      g.fillStyle = '#e8e8e8'; g.font = '13px "Share Tech Mono", monospace';
      g.fillText('15.8V', 10, 20); g.fillText('02:14', W-58, 20);
    }

    function drawAnalog(){
      var g = A.g;
      scene(g);
      var noise = clamp(1 - sig, 0, 1);
      if(noise > 0.03){
        var img = g.getImageData(0,0,W,H), d = img.data;
        var amt = noise * noise * 255;
        for(var i=0;i<d.length;i+=4){
          if(Math.random() < noise * 0.85){
            var n = (Math.random()*2-1) * amt;
            d[i]   = clamp(d[i]   + n, 0, 255);
            d[i+1] = clamp(d[i+1] + n, 0, 255);
            d[i+2] = clamp(d[i+2] + n, 0, 255);
          }
        }
        g.putImageData(img,0,0);
        /* rolling tear lines */
        var lines = Math.floor(noise * 9);
        g.fillStyle = 'rgba(230,230,230,.55)';
        for(var l=0;l<lines;l++){
          var y = Math.floor(Math.random()*H);
          g.fillRect(0, y, W, 1 + Math.random()*2);
        }
      }
      A.st.textContent = sig > 0.75 ? 'clean' :
                         sig > 0.45 ? 'grain - you\'re getting far out' :
                         sig > 0.18 ? 'heavy static - turn back now' :
                                      'snow, but you can still fly it home';
    }

    function drawDigital(){
      var g = D.g;
      if(sig < 0.32){
        g.fillStyle = '#000'; g.fillRect(0,0,W,H);
        g.fillStyle = '#3a3a3a'; g.font = '15px "Share Tech Mono", monospace';
        g.textAlign = 'center';
        g.fillText('NO SIGNAL', W/2, H/2);
        g.textAlign = 'left';
        D.st.textContent = 'black. nothing at all.';
        return;
      }
      scene(g);
      if(sig < 0.58){
        /* blockiness: quantise to 16px tiles and drop some of them */
        var img = g.getImageData(0,0,W,H), d = img.data;
        var B = 16, bad = (0.58 - sig) / 0.26;
        for(var by=0;by<H;by+=B){
          for(var bx=0;bx<W;bx+=B){
            var si = ((by+2)*W + bx+2)*4;
            var r=d[si],gg=d[si+1],b=d[si+2];
            var kill = Math.random() < bad*0.45;
            for(var y=by;y<by+B && y<H;y++){
              for(var x=bx;x<bx+B && x<W;x++){
                var di=(y*W+x)*4;
                d[di]= kill?12:r; d[di+1]= kill?12:gg; d[di+2]= kill?12:b;
              }
            }
          }
        }
        g.putImageData(img,0,0);
        D.st.textContent = 'freezing and breaking into blocks';
      } else {
        D.st.textContent = sig > 0.78 ? 'perfect' : 'still perfect - no warning at all';
      }
    }

    /* THE EXPENSIVE ONE, and why it\'s throttled.

       Each pane is a 340x200 getImageData / per-pixel loop / putImageData pass.
       At 60 fps that was two full passes over 68000 pixels and roughly four
       million Math.random() calls a second - permanently, for as long as the
       lesson was open, on a Ryzen 5 that\'s also running a simulator.

       Two changes. It runs at ~15 fps, which is plenty for static to look like
       static and is what analog noise wants anyway. And it only repaints when
       the picture can actually differ from the one already on screen: analog is
       a fixed image once noise is negligible, digital is a fixed image whenever
       it\'s clean or fully black. Move the slider and both wake up. */
    var FPS = 15, FRAME_MS = 1000 / FPS;
    var lastPaint = 0, lastSig = -1;

    function tick(ts){
      raf = requestAnimationFrame(tick);
      if(ts - lastPaint < FRAME_MS) return;
      lastPaint = ts;

      var moved = (sig !== lastSig);
      lastSig = sig;

      /* analog only animates while there\'s visible grain to shimmer */
      if(moved || (1 - sig) > 0.03) drawAnalog();
      /* digital is a still image unless it\'s in the blocky band */
      if(moved || (sig >= 0.32 && sig < 0.58)) drawDigital();
    }
    raf = requestAnimationFrame(tick);
    return { stop:function(){ if(raf) cancelAnimationFrame(raf); raf = 0; } };
  }

  /* ---------------------------------------------------------------------
     gs-vid-03 - aim the patch
     --------------------------------------------------------------------- */
  function patch(root){
    var aim = 0;                 /* radians, 0 = straight up the screen */
    var raf = 0, t = 0, best = 0, worst = 100, samples = 0, lastMsg = null;

    var w = h('div','');
    w.style.cssText = 'max-width:760px;margin:0 auto';
    root.appendChild(w);

    var stage = h('div','stage');
    var cv = document.createElement('canvas');
    stage.appendChild(cv);
    w.appendChild(stage);
    var g = cv.getContext('2d');
    var W = 760, H = 380;
    function size(){
      var cssW = stage.clientWidth || W;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.style.height = Math.round(cssW*H/W) + 'px';
      cv.width = Math.round(cssW*dpr); cv.height = Math.round(cssW*H/W*dpr);
      var s = (cssW*dpr)/W;
      g.setTransform(s,0,0,s,0,0);
    }
    size();
    window.addEventListener('resize', size);

    var ctrl = h('div','');
    ctrl.style.cssText = 'display:flex;align-items:center;gap:14px;margin-top:14px;flex-wrap:wrap;justify-content:center';
    var sl = document.createElement('input');
    sl.type='range'; sl.min='-90'; sl.max='90'; sl.value='0';
    sl.style.cssText='flex:1 1 260px;max-width:420px';
    sl.oninput = function(){ aim = parseInt(sl.value,10) * Math.PI/180; };
    ctrl.appendChild(h('span','','<span style="font-family:var(--font-mono);font-size:11px;letter-spacing:1.6px;color:var(--ink-soft)">AIM THE PATCH</span>'));
    ctrl.appendChild(sl);
    w.appendChild(ctrl);

    var readout = h('div','');
    readout.style.cssText='font-family:var(--font-hand);font-size:18px;color:var(--rust);text-align:center;margin-top:10px;min-height:26px';
    w.appendChild(readout);

    var PILOT = { x:W/2, y:H-34 };
    var CONE = 0.62;              /* half-angle of the patch, radians */

    function tick(){
      t += 0.012;
      /* the aircraft flies a lap that spends real time off to one side */
      var ax = W/2 + Math.cos(t*0.9) * 250 - 40;
      var ay = 120 + Math.sin(t*1.7) * 62;

      /* link quality: the patch cone, plus a weak omni everywhere */
      var dx = ax - PILOT.x, dy = ay - PILOT.y;
      var bearing = Math.atan2(dx, -dy);
      var off = Math.abs(bearing - aim);
      if(off > Math.PI) off = Math.PI*2 - off;
      var dist = Math.hypot(dx,dy) / 300;
      var inCone = off < CONE;
      var patchQ = inCone ? clamp(1.15 - dist*0.42, 0, 1) * (1 - (off/CONE)*0.28) : 0;
      var omniQ  = clamp(0.82 - dist*0.78, 0, 1);
      var q = Math.max(patchQ, omniQ);
      var pct = Math.round(q*100);
      samples++;
      if(samples > 30){ best = Math.max(best,pct); worst = Math.min(worst,pct); }

      g.clearRect(0,0,W,H);
      g.fillStyle = 'rgba(255,253,247,.6)'; g.fillRect(0,0,W,H);
      g.strokeStyle='rgba(31,51,80,.10)'; g.lineWidth=1;
      g.beginPath();                        /* one path, not one per line */
      for(var x=0;x<=W;x+=28){ g.moveTo(x,0); g.lineTo(x,H); }
      for(var y=0;y<=H;y+=28){ g.moveTo(0,y); g.lineTo(W,y); }
      g.stroke();

      /* the patch cone */
      g.save();
      g.translate(PILOT.x, PILOT.y);
      g.rotate(aim);
      g.fillStyle = 'rgba(143,61,18,.13)';
      g.strokeStyle = '#8f3d12'; g.lineWidth = 1.8; g.setLineDash([6,5]);
      g.beginPath();
      g.moveTo(0,0);
      g.arc(0,0,330,-Math.PI/2-CONE,-Math.PI/2+CONE);
      g.closePath(); g.fill(); g.stroke();
      g.setLineDash([]);
      /* the patch itself */
      g.fillStyle='#eae2d1'; g.strokeStyle='#1f3350'; g.lineWidth=2.2;
      g.beginPath(); g.rect(-15,-16,30,13); g.fill(); g.stroke();
      g.restore();

      /* the omni's weak circle */
      g.strokeStyle='rgba(28,85,120,.35)'; g.lineWidth=1.4; g.setLineDash([4,6]);
      g.beginPath(); g.arc(PILOT.x, PILOT.y, 246, Math.PI, 0); g.stroke();
      g.setLineDash([]);
      g.fillStyle='#1c5578'; g.font='10px "Share Tech Mono", monospace';
      g.fillText('OMNI', PILOT.x+250, PILOT.y-6);

      /* pilot + aircraft */
      g.fillStyle='#1f3350';
      g.beginPath(); g.arc(PILOT.x, PILOT.y, 7, 0, 6.2832); g.fill();
      var col = pct > 70 ? '#1f5230' : (pct > 35 ? '#7d5810' : '#8f3d12');
      g.strokeStyle = col; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(ax-13,ay-13); g.lineTo(ax+13,ay+13);
      g.moveTo(ax+13,ay-13); g.lineTo(ax-13,ay+13); g.stroke();

      /* link bar */
      var bx = 24, by = 24, bw = 190;
      g.strokeStyle='#546881'; g.lineWidth=1.4; g.strokeRect(bx,by,bw,14);
      g.fillStyle = col; g.fillRect(bx,by,bw*q,14);
      g.fillStyle='#546881'; g.font='11px "Share Tech Mono", monospace';
      g.fillText('LINK  ' + pct + '%', bx, by-6);
      g.fillText(inCone ? 'in the patch cone' : 'omni only', bx + bw + 12, by+11);

      /* three fixed strings, so write only on a change of state rather than
         rebuilding identical innerHTML sixty times a second */
      var msg = pct > 70
        ? 'Strong. The patch is pointed where the aircraft actually is.'
        : (inCone ? 'In the cone but a long way out.' : 'Outside the cone - you\'re running on the omni alone.');
      if(msg !== lastMsg){ lastMsg = msg; readout.textContent = msg; }

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return { stop:function(){ if(raf) cancelAnimationFrame(raf); window.removeEventListener('resize', size); } };
  }

  return { voltage:voltage, signal:signal, patch:patch };
})();
