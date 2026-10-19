/* confetti.js - a badge-earned celebration, shared by the kiosk dash, the
   Ground School course and the website (copied there verbatim).

   No library and no network: a full-window canvas that ignores the pointer,
   ~3 seconds of falling paper in the club colours, then it removes itself.
   ES5 like the rest of the kiosk. Respects prefers-reduced-motion (a short,
   small burst instead of the full fall).

     FPVConfetti.burst()            confetti across the whole window
     FPVConfetti.congrats(title, lines, onClose)
                                    a small card ("Congrats on ___") over the
                                    page, with confetti behind it; closes on
                                    the button, a tap outside, or after 12 s
*/
(function(){
  var COLORS = ['#f0a91a', '#8f3d12', '#1c5578', '#1f5230', '#4b3287', '#f2ece0', '#d9534f'];
  var running = null;

  function reduced(){
    try{ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; }
  }

  function burst(opts){
    opts = opts || {};
    var count = opts.count || (reduced() ? 40 : 180);
    var dur = opts.duration || (reduced() ? 1200 : 3200);
    var c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483646';
    document.body.appendChild(c);
    var dpr = window.devicePixelRatio || 1, W = window.innerWidth, H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    var ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    var parts = [];
    for(var i = 0; i < count; i++){
      parts.push({
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.5,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        sway: Math.random() * Math.PI * 2,
        color: COLORS[(Math.random() * COLORS.length) | 0]
      });
    }
    var start = null, me = {};
    running = me;
    function frame(t){
      if(start === null) start = t;
      var el = t - start;
      ctx.clearRect(0, 0, W, H);
      var fade = el > dur - 600 ? Math.max(0, (dur - el) / 600) : 1;
      ctx.globalAlpha = fade;
      for(var i = 0; i < parts.length; i++){
        var p = parts[i];
        p.sway += 0.05;
        p.x += p.vx + Math.sin(p.sway) * 0.8;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
        ctx.restore();
      }
      if(el < dur){ requestAnimationFrame(frame); }
      else { if(c.parentNode) c.parentNode.removeChild(c); if(running === me) running = null; }
    }
    requestAnimationFrame(frame);
  }

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* title: e.g. "Congrats on Safe Flight!"; lines: array of short strings. */
  function congrats(title, lines, onClose){
    var wrap = document.createElement('div');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-live', 'polite');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483645;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(16,24,38,.35);padding:16px';
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';   // theme.js (2026-10-18)
    var bg = dark ? '#222c3b' : '#fffdf7', fg = dark ? '#e2e8f1' : '#1f3350';
    wrap.innerHTML =
      '<div style="background:' + bg + ';color:' + fg + ';border:2px solid ' + fg + ';border-radius:14px;max-width:460px;width:100%;' +
      'padding:26px 26px 22px;box-shadow:0 18px 50px rgba(0,0,0,.3);text-align:center;font-family:Barlow,system-ui,sans-serif">' +
      '<div style="font-family:\'Share Tech Mono\',monospace;letter-spacing:.18em;font-size:14px;color:' + (dark ? '#e8865c' : '#8f3d12') + ';text-transform:uppercase">Badge earned</div>' +
      '<div style="font-size:28px;font-weight:700;line-height:1.15;margin:8px 0 10px">' + esc(title) + '</div>' +
      (lines || []).map(function(l){ return '<div style="font-size:17px;line-height:1.45;margin:4px 0">' + esc(l) + '</div>'; }).join('') +
      '<button type="button" style="margin-top:18px;font:600 17px Barlow,system-ui,sans-serif;padding:10px 26px;border-radius:999px;' +
      'border:2px solid ' + fg + ';background:#f0a91a;color:#1f3350;cursor:pointer">Nice!</button></div>';
    var done = false;
    function close(){
      if(done) return; done = true;
      if(wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if(onClose) try{ onClose(); }catch(e){}
    }
    wrap.addEventListener('click', function(e){ if(e.target === wrap || e.target.tagName === 'BUTTON') close(); });
    document.body.appendChild(wrap);
    setTimeout(close, 12000);
    burst();
    return close;
  }

  window.FPVConfetti = { burst: burst, congrats: congrats };
})();
