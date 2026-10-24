// End-of-game moments: a full-screen particle layer (pointer-events: none, above the sheets) plus a big
// handwritten "stamp" word. Each game picks the pieces that fit its theme:
//   FX.burst({ el|x,y, shapes, colors, count, speed, ... })   particles flung out from a point
//   FX.rain({ shapes, colors, count, ... })                    particles falling from the top of the screen
//   FX.fireworks({ el, colors, shells, ... })                  several bursts over time
//   FX.ripples({ el|x,y, color, rings })                       ink rings spreading out (Go)
//   FX.vines({ color, leaf })                                  vines growing up the sides with leaves (Tendril)
//   FX.rangoli({ el|x,y, colors })                             petals blooming in rings (Chowka Bara)
//   FX.wave({ el, cols, rows, color })                         a lit wave across a grid's squares (Chess, Sudoku)
//   FX.stamp(text, { color })                                  the big word
//   FX.css(name) reads a CSS colour variable.  With reduced motion only the stamp shows, without movement.
// burst options also take grow (seconds to swell in), spin (turn speed) and fade (share of life spent fading).
// Shapes: confetti, star, digit, leaf, clover, shell, stone, petal, pixel, bubble, crown, spark.
(function(){
'use strict';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0];
let cv = null, ctx = null, parts = [], fx = [], raf = 0, dpr = 1, last = 0;

function css(name, fallback){ const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback || '#2e5ea6'; }
function centre(o){
  if (o.el){ const el = typeof o.el === 'string' ? document.querySelector(o.el) : o.el; if (el){ const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; } }
  return { x: o.x != null ? o.x : innerWidth / 2, y: o.y != null ? o.y : innerHeight * .42, r: null };
}
function layer(){
  if (!cv){
    cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:90';
    document.body.appendChild(cv); ctx = cv.getContext('2d');
  }
  dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== innerWidth * dpr || cv.height !== innerHeight * dpr){ cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  if (!raf){ last = performance.now(); raf = requestAnimationFrame(frame); }
}

// ---- shapes (drawn centred at 0,0, size s) ----
const SH = {
  confetti(c, s, p){ c.scale(1, Math.cos(p.t * p.flip)); c.fillRect(-s / 2, -s / 4, s, s / 2); },
  pixel(c, s){ c.fillRect(-s / 2, -s / 2, s, s); },
  star(c, s){ c.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? s * .42 : s; c.lineTo(r * Math.cos(a), r * Math.sin(a)); } c.closePath(); c.fill(); },
  spark(c, s){ c.fillRect(-s, -s * .09, s * 2, s * .18); c.fillRect(-s * .09, -s, s * .18, s * 2); },
  digit(c, s, p){ c.font = `${s * 2}px "Gochi Hand","Marker Felt",cursive`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.ch, 0, 0); },
  leaf(c, s){ c.beginPath(); c.moveTo(0, s * .55); c.bezierCurveTo(-s * 1.1, -s * .1, -s * .45, -s * 1.05, 0, -s * .35); c.bezierCurveTo(s * .45, -s * 1.05, s * 1.1, -s * .1, 0, s * .55); c.fill(); },
  clover(c, s){ for (let k = 0; k < 4; k++){ c.save(); c.rotate(k * Math.PI / 2 + Math.PI / 4); c.translate(0, -s * .55); SH.leaf(c, s * .62); c.restore(); }
    c.save(); c.strokeStyle = c.fillStyle; c.lineWidth = s * .16; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * .3, s * .7, s * .7, s * 1.1); c.stroke(); c.restore(); },
  shell(c, s){ // a cowry: cream dome with a dark toothed slit
    c.beginPath(); c.ellipse(0, 0, s * .62, s, 0, 0, TAU); c.fillStyle = '#f4e6c8'; c.fill(); c.strokeStyle = '#b48a4e'; c.lineWidth = s * .1; c.stroke();
    c.beginPath(); c.moveTo(0, -s * .78); c.quadraticCurveTo(s * .16, 0, 0, s * .78); c.strokeStyle = '#5e4425'; c.lineWidth = s * .16; c.stroke();
    c.lineWidth = s * .07; for (let k = -3; k <= 3; k++){ const y = k * s * .2; c.beginPath(); c.moveTo(-s * .18, y); c.lineTo(s * .2, y); c.stroke(); } },
  stone(c, s, p){ const g = c.createRadialGradient(-s * .35, -s * .35, s * .1, 0, 0, s); const w = p.color === 'w';
    g.addColorStop(0, w ? '#ffffff' : '#6a6f76'); g.addColorStop(1, w ? '#d7d9dc' : '#111418'); c.beginPath(); c.arc(0, 0, s, 0, TAU); c.fillStyle = g; c.fill();
    c.lineWidth = Math.max(1, s * .08); c.strokeStyle = w ? '#9aa1a8' : '#000'; c.stroke(); },
  petal(c, s){ c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * .55, -s * .7, 0, -s * 1.6); c.quadraticCurveTo(-s * .55, -s * .7, 0, 0); c.fill(); },
  bubble(c, s){ c.beginPath(); c.arc(0, 0, s, 0, TAU); c.lineWidth = Math.max(1.2, s * .14); c.strokeStyle = c.fillStyle; c.stroke();
    c.beginPath(); c.arc(-s * .35, -s * .35, s * .25, 0, TAU); c.fill(); },
  crown(c, s){ c.beginPath(); c.moveTo(-s, s * .55); c.lineTo(-s, -s * .3); c.lineTo(-s * .5, s * .1); c.lineTo(0, -s * .75); c.lineTo(s * .5, s * .1); c.lineTo(s, -s * .3); c.lineTo(s, s * .55); c.closePath(); c.fill();
    c.fillStyle = '#fff6'; [-s, 0, s].forEach(x => { c.beginPath(); c.arc(x, x ? -s * .36 : -s * .82, s * .13, 0, TAU); c.fill(); }); },
};
function add(p){ if (parts.length < 420) parts.push(Object.assign({ t: 0, vr: rnd(-6, 6), rot: rnd(0, TAU), flip: rnd(5, 11), g: 900, drag: .985, sway: 0, alpha: 1, fade: .3 }, p)); }

// ---- the effects ----
function burst(o = {}){
  if (reduced) return; layer();
  const { x, y } = centre(o), n = o.count || 90, colors = o.colors || [css('--hit'), css('--miss'), css('--present', '#d38c1f')], shapes = o.shapes || ['confetti'];
  const sp = o.speed == null ? 900 : o.speed, spread = o.spread == null ? TAU : o.spread, dir = o.dir == null ? -Math.PI / 2 : o.dir;
  for (let i = 0; i < n; i++){
    const a = dir + rnd(-spread / 2, spread / 2), v = sp * rnd(.35, 1), sh = pick(shapes);
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: (o.size || 9) * rnd(.65, 1.35), shape: sh, color: pick(colors), ch: o.chars ? pick(o.chars) : '',
      ttl: (o.ttl || 2.2) * rnd(.75, 1.15), g: o.gravity == null ? 900 : o.gravity, drag: o.drag || .985, sway: o.sway || 0, delay: (o.delay || 0) + (o.stagger ? rnd(0, o.stagger) : 0),
      grow: o.grow || 0, vr: o.spin != null ? o.spin : rnd(-6, 6), fade: o.fade || .3 });
  }
}
function rain(o = {}){
  if (reduced) return; layer();
  const n = o.count || 70, colors = o.colors || [css('--hit')], shapes = o.shapes || ['confetti'];
  for (let i = 0; i < n; i++) add({ x: rnd(0, innerWidth), y: rnd(-80, -10), vx: rnd(-40, 40), vy: rnd(60, 200) * (o.speed || 1), s: (o.size || 10) * rnd(.7, 1.3),
    shape: pick(shapes), color: pick(colors), ch: o.chars ? pick(o.chars) : '', ttl: o.ttl || 3.6, g: o.gravity == null ? 120 : o.gravity, drag: .995, sway: o.sway == null ? 60 : o.sway,
    delay: (o.delay || 0) + rnd(0, o.over || 1.2), vr: rnd(-3, 3) });
}
function fireworks(o = {}){
  if (reduced) return;
  const box = centre(o), r = box.r || { left: 0, top: 0, width: innerWidth, height: innerHeight * .7 }, shells = o.shells || 5;
  for (let k = 0; k < shells; k++) setTimeout(() => {
    const x = r.left + rnd(.15, .85) * r.width, y = r.top + rnd(.1, .6) * r.height, cols = o.colors || [css('--hit'), css('--miss'), '#f0c24a'];
    burst({ x, y, count: o.count || 60, colors: [pick(cols), pick(cols), '#ffffff'], shapes: o.shapes || ['star', 'spark'], speed: o.speed || 520, gravity: 260, drag: .965, size: o.size || 6, ttl: 1.6 });
  }, (o.delay || 0) * 1000 + k * (o.gap || 260));
}
function ripples(o = {}){
  if (reduced) return; layer();
  const { x, y, r } = centre(o), max = o.max || (r ? Math.max(r.width, r.height) * .75 : 260);
  for (let k = 0; k < (o.rings || 4); k++) fx.push({ kind: 'ring', x, y, t: -(o.delay || 0) - k * (o.gap || .22), ttl: o.ttl || 1.6, max, color: o.color || css('--ink'), w: o.width || 3 });
}
function vines(o = {}){
  if (reduced) return; layer();
  const H = innerHeight, W = innerWidth, color = o.color || css('--em-tendril', '#3f8f4f'), leaf = o.leaf || css('--em-leaf', '#8fcf86');
  // a vine: rises with a gentle S-curve and ends in a curl
  const mk = (x0, side) => { const pts = [], top = H * rnd(.62, .82), ph = rnd(0, TAU), amp = rnd(18, 30);
    for (let i = 0; i <= 60; i++){ const f = i / 60; pts.push([x0 + side * (Math.sin(f * 7 + ph) * amp * (1 - f * .4) + f * W * .1), H + 10 - f * top]); }
    const [ex, ey] = pts[pts.length - 1]; for (let i = 1; i <= 14; i++){ const a = i / 14 * Math.PI * 1.6, r = 16 * (1 - i / 18); pts.push([ex + side * (r - r * Math.cos(a)), ey - r * Math.sin(a)]); }
    return pts; };
  [[W * .06, 1], [W * .94, -1], [W * .3, 1], [W * .7, -1]].slice(0, o.count || 4).forEach(([x0, side], k) =>
    fx.push({ kind: 'vine', pts: mk(x0, side), t: -k * .15, ttl: o.ttl || 2.8, grow: 1.1, color, leaf, side, leaves: [.22, .38, .52, .66, .8, .93].map(f => ({ f, s: rnd(9, 15), a: rnd(-.5, .5) })) }));
}
function rangoli(o = {}){
  if (reduced) return; layer();
  const { x, y } = centre(o), colors = o.colors || [css('--hit'), css('--miss'), '#f0c24a', '#2fa36b'];
  [[8, 26, 0], [12, 52, .15], [16, 82, .3], [20, 112, .45]].forEach(([n, rad, d], ring) =>
    fx.push({ kind: 'bloom', x, y, n, rad, t: -d - (o.delay || 0), ttl: o.ttl || 2.2, color: colors[ring % colors.length], s: 10 + ring * 3, spin: ring % 2 ? -1 : 1 }));
}
function wave(o = {}){
  if (reduced) return; layer();
  const el = typeof o.el === 'string' ? document.querySelector(o.el) : o.el; if (!el) return;
  const r = el.getBoundingClientRect();
  fx.push({ kind: 'wave', r, cols: o.cols || 8, rows: o.rows || o.cols || 8, t: -(o.delay || 0), ttl: o.ttl || 1.3, color: o.color || '#f0c24a', from: o.from || [0, 0] });
}
function stamp(text, o = {}){
  const d = document.createElement('div'); d.setAttribute('aria-hidden', 'true'); d.textContent = text;
  const color = o.color || css('--hit');
  d.style.cssText = `position:fixed;left:50%;top:${o.top || 30}%;z-index:91;pointer-events:none;font-family:"Gochi Hand","Marker Felt",cursive;font-size:${o.size || 'clamp(2.6rem,13vw,4.4rem)'};line-height:1;white-space:nowrap;
    color:${color};-webkit-text-stroke:2px rgba(255,255,255,.85);paint-order:stroke fill;text-shadow:0 4px 0 rgba(0,0,0,.12),0 10px 28px rgba(0,0,0,.25);transform:translate(-50%,-50%) rotate(${o.tilt == null ? -6 : o.tilt}deg)`;
  document.body.appendChild(d);
  const hold = o.hold || 1500;
  if (reduced){ setTimeout(() => d.remove(), hold); return; }
  d.animate([{ transform: d.style.transform + ' scale(.2)', opacity: 0 }, { transform: d.style.transform + ' scale(1.18)', opacity: 1, offset: .55 }, { transform: d.style.transform + ' scale(1)', opacity: 1 }],
    { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
  setTimeout(() => d.animate([{ opacity: 1 }, { opacity: 0, transform: d.style.transform + ' translateY(-18px)' }], { duration: 380, fill: 'forwards' }).onfinish = () => d.remove(), hold);
}

// ---- the loop ----
function frame(now){
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = fx.length - 1; i >= 0; i--){
    const e = fx[i]; e.t += dt; if (e.t > e.ttl){ fx.splice(i, 1); continue; } if (e.t < 0) continue;
    const f = e.t / e.ttl;
    if (e.kind === 'ring'){
      c.globalAlpha = (1 - f) * .85; c.strokeStyle = e.color; c.lineWidth = e.w * (1 - f * .6);
      c.beginPath(); c.arc(e.x, e.y, 8 + e.max * (1 - Math.pow(1 - f, 2.4)), 0, TAU); c.stroke();
    } else if (e.kind === 'vine'){
      const g = Math.min(1, e.t / e.grow), n = Math.max(2, Math.round(g * (e.pts.length - 1)) + 1), fade = f > .8 ? (1 - f) / .2 : 1;
      c.globalAlpha = fade; c.strokeStyle = e.color; c.lineWidth = 4.5; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); e.pts.slice(0, n).forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke();
      e.leaves.forEach(L => { if (g < L.f) return; const [x, y] = e.pts[Math.round(L.f * (e.pts.length - 1))], grow = Math.min(1, (g - L.f) * 6 + (e.t > e.grow ? 1 : 0));
        c.save(); c.translate(x, y); c.rotate((e.side > 0 ? .9 : -.9) * (L.f * 10 % 2 > 1 ? 1 : -1) + L.a); c.translate(0, -L.s * .5); c.fillStyle = e.leaf; SH.leaf(c, L.s * grow); c.restore(); });
      const [hx, hy] = e.pts[n - 1]; c.fillStyle = e.color; c.beginPath(); c.arc(hx, hy, 3.5, 0, TAU); c.fill();
    } else if (e.kind === 'bloom'){
      const g = Math.min(1, f * 2.2), a = f > .7 ? (1 - f) / .3 : 1; c.globalAlpha = a; c.fillStyle = e.color;
      for (let k = 0; k < e.n; k++){ c.save(); c.translate(e.x, e.y); c.rotate(k * TAU / e.n + e.spin * f * .9); c.translate(0, -e.rad * g); SH.petal(c, e.s * g); c.restore(); }
      c.beginPath(); c.arc(e.x, e.y, 6 * g, 0, TAU); c.fill();
    } else if (e.kind === 'wave'){
      const { r, cols, rows } = e, w = r.width / cols, h = r.height / rows, reach = (cols + rows) * f * 1.25;
      c.fillStyle = e.color;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++){
        const d = Math.abs(x - e.from[0]) + Math.abs(y - e.from[1]), k = reach - d; if (k < 0 || k > 3) continue;
        c.globalAlpha = Math.sin(k / 3 * Math.PI) * .55; c.fillRect(r.left + x * w + 1, r.top + y * h + 1, w - 2, h - 2);
      }
    }
  }
  for (let i = parts.length - 1; i >= 0; i--){
    const p = parts[i];
    if (p.delay > 0){ p.delay -= dt; continue; }
    p.t += dt; if (p.t > p.ttl || p.y > innerHeight + 60){ parts.splice(i, 1); continue; }
    p.vx *= Math.pow(p.drag, dt * 60); p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.g * dt;
    p.x += (p.vx + (p.sway ? Math.sin(p.t * 3 + p.rot) * p.sway : 0)) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const left = p.ttl - p.t; c.globalAlpha = left < p.ttl * p.fade ? left / (p.ttl * p.fade) : 1;
    // grow: the particle swells in over that many seconds with a little overshoot
    const gk = p.grow ? Math.min(1, p.t / p.grow) : 1, gs = p.grow ? 1 + 2.2 * Math.pow(gk - 1, 3) + 1.2 * Math.pow(gk - 1, 2) : 1;
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color; SH[p.shape](c, p.s * Math.max(0, gs), p); c.restore();
  }
  c.globalAlpha = 1;
  if (parts.length || fx.length) raf = requestAnimationFrame(frame);
  else { raf = 0; c.clearRect(0, 0, innerWidth, innerHeight); }
}

window.FX = { burst, rain, fireworks, ripples, vines, rangoli, wave, stamp, css, reduced };
})();
