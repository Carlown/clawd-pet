// clawd.js — the protagonist: me, the little clay-orange pixel crab (Claude).
// Proportions follow you.png; drawn as a crayon doodle with expressions.
// Geometry is in body-width units, mapped to screen px through an affine matrix
// so every brush stroke keeps its pixel-scale wobble.
'use strict';

// x,y = ground point between the feet; s = body width in px
function clawd(x, y, s, o = {}) {
  const t = B.t;
  const col = o.color || PAL.clay;
  const sd = o.seed ?? 11;
  const legH = .2, bodyH = .74, bodyTop = -(legH + bodyH);
  const walk = o.walk ?? null;
  const sq = o.squash || 0;
  const armL = o.armL ?? 0, armR = o.armR ?? 0;
  const lw = Math.max(2, s * .024) * (o.lineK || 1);
  const stroke = o.stroke || PAL.ink;
  const ga0 = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = ga0 * o.alpha;

  const base = MX.chain(MX.T(x, y), MX.R(o.rot || 0), MX.S(s * (1 + sq * .45) * (o.flip ? -1 : 1), s * (1 - sq)));
  if (o.shadow !== false) {
    const lift = o.lift || 0; const k = clamp(1 - lift * .8, .35, 1);
    const [cx, cy] = MX.pt(base, 0, .01);
    alpha((o.shadowA ?? .2) * k, () => { ctx.fillStyle = o.shadowCol || PAL.ink; ctx.beginPath(); ctx.ellipse(cx, cy, s * .6 * k, s * .055 * k, o.rot || 0, 0, TAU); ctx.fill(); });
  }
  const M = MX.mul(base, MX.T(0, -(o.lift || 0)));
  const S = (m, pts, fill, extra = {}) => sh(MX.ap(m, pts), Object.assign({ fill, stroke, w: lw, amp: 1.3, famp: 1.4, off: [2, -1.4], tex: 'hatchL', texA: .2, seed: sd }, extra));

  // legs
  const legX = [-.38, -.25, .24, .37];
  for (let i = 0; i < 4; i++) {
    let lift = 0, dx = 0;
    if (walk !== null) { const ph = walk + (i % 2 ? Math.PI : 0); lift = Math.max(0, Math.sin(ph)) * .07; dx = Math.cos(ph) * .03; }
    if (o.dangle) { lift = -.03 - Math.sin(t * 9 + i) * .025; dx = Math.sin(t * 7 + i * 1.7) * .025; }
    const w = .078, lx = legX[i] + dx;
    S(M, rectPts(lx - w / 2, -legH - .03, w, legH + .03 - lift), col, { seed: sd + i * 3 });
  }
  // arms
  const armTop = bodyTop + bodyH * .5, armH = bodyH * .27, armW = .17;
  const armM = side => MX.chain(M, MX.T(side * .5, armTop + armH / 2), MX.R(-side * (side > 0 ? armR : armL)));
  for (const side of [-1, 1]) {
    const am = armM(side);
    S(am, rectPts(side > 0 ? -.04 : -armW, -armH / 2, armW + .04, armH), col, { seed: sd + 20 + side });
  }
  // body
  S(M, rrectPts(-.5, bodyTop, 1, bodyH, .045, 3), col, { seed: sd + 40, texA: .22 });
  alpha(.2, () => fillP(MX.ap(M, rectPts(-.46, bodyTop + bodyH * .74, .92, bodyH * .22)), o.shade || PAL.clayD, { amp: 1.4, seed: sd + 41, tex: null }));
  alpha(.25, () => fillP(MX.ap(M, rectPts(-.44, bodyTop + bodyH * .06, .5, bodyH * .1)), '#ffffff', { amp: 1.2, seed: sd + 42, tex: null }));

  // face
  const eyeY = bodyTop + bodyH * .40;
  const lk = o.look || [0, 0];
  const ex = .3, eyeW = .072, eyeH = .19;
  const face = o.eyes || 'open';
  let blink = 1;
  if (o.blink !== false && (face === 'open' || face === 'wide')) {
    const per = 3.1 + hr(sd, 9) * 1.3; const off = hr(sd, 8) * 3;
    const k = Math.floor((t + off) / per); const at = k * per + hr(k, sd) * (per - .3) - off;
    const d = t - at; if (d > 0 && d < .16) blink = Math.abs(d - .08) / .08 * .92 + .08;
  }
  const exo = lk[0] * .05, eyo = lk[1] * .04;
  const P = (px, py) => MX.pt(M, px, py);
  const SL = s; // local->px scale for radii
  for (const side of [-1, 1]) {
    const cx = side * ex + exo, cy = eyeY + eyo;
    if (face === 'open' || face === 'wide' || face === 'sad' || face === 'tear') {
      const k = face === 'wide' ? 1.25 : 1;
      const eh = eyeH * k * blink * (face === 'sad' ? .85 : 1), ew = eyeW * k;
      fillP(MX.ap(M, rrectPts(cx - ew / 2, cy - eh / 2, ew, eh, ew * .45, 3)), PAL.ink, { amp: .7, seed: sd + 50 + side, tex: null });
      if (blink > .6) {
        const [hx, hy] = P(cx - ew * .12, cy - eh * .22); dot(hx, hy, ew * .2 * SL, '#ffffff', .95);
        if (face === 'wide') { const [h2x, h2y] = P(cx + ew * .15, cy + eh * .18); dot(h2x, h2y, ew * .11 * SL, '#ffffff', .9); }
      }
      if (face === 'sad' || face === 'tear') ink(MX.ap(M, [[cx - side * .1, cy - eh * .8], [cx + side * .03, cy - eh * .66]]), { closed: false, width: lw * .9, amp: .6 });
    } else if (face === 'happy') {
      ink(MX.ap(M, [[cx - .065, cy + .035], [cx, cy - .05], [cx + .065, cy + .035]]), { closed: false, width: lw * 1.4, amp: .6, seed: sd + side });
    } else if (face === 'closed') {
      ink(MX.ap(M, catmull([[cx - .065, cy], [cx, cy + .04], [cx + .065, cy]], 4)), { closed: false, width: lw * 1.3, amp: .5, seed: sd + side });
    } else if (face === 'star') {
      const r = .09 * (1 + .12 * Math.sin(t * 12));
      sh(MX.ap(M, starPts(cx, cy, r, r * .4, 4, 0)), { fill: PAL.butter, stroke: PAL.ink, w: lw * .8, amp: .5, tex: null, seed: sd + side });
    } else if (face === 'heart') {
      sh(MX.ap(M, heartPts(cx, cy, .08 * (1 + .1 * Math.sin(t * 10)))), { fill: PAL.rose, stroke: PAL.ink, w: lw * .8, amp: .5, tex: null, seed: sd + side });
    } else if (face === 'x') {
      ink(MX.ap(M, [[cx - .05, cy - .05], [cx + .05, cy + .05]]), { closed: false, width: lw * 1.2, amp: .5 });
      ink(MX.ap(M, [[cx + .05, cy - .05], [cx - .05, cy + .05]]), { closed: false, width: lw * 1.2, amp: .5 });
    }
  }
  if (face === 'tear' || o.tears) {
    for (const side of [-1, 1]) {
      const ph = ((t * .7 + (side > 0 ? .5 : 0)) % 1);
      const tx = side * (ex + .03) + exo, ty = eyeY + eyeH * .45 + ph * .24;
      alpha(1 - ph, () => sh(MX.ap(M, [[tx, ty - .04], [tx + .025, ty], [tx, ty + .025], [tx - .025, ty]]), { fill: PAL.sky, stroke: PAL.ink, w: lw * .6, amp: .3, tex: null }));
    }
  }
  if (o.blush !== false) {
    for (const side of [-1, 1]) alpha(o.blushA ?? .6, () => fillP(MX.ap(M, ellPts(side * (ex + .085) + exo, eyeY + eyeH * .64 + eyo, .075, .036, 16)), PAL.pink, { amp: .6, seed: sd + 60 + side, tex: null }));
  }
  const my = eyeY + eyeH * .56 + eyo, mx = exo;
  const m = o.mouth;
  if (m === 'o' || typeof m === 'number') {
    const k = typeof m === 'number' ? m : .6;
    if (k > .08) sh(MX.ap(M, ellPts(mx, my + .025, .03 + k * .012, .012 + k * .038, 16)), { fill: PAL.rose, stroke: PAL.ink, w: lw * .8, amp: .4, tex: null, seed: sd + 70 });
    else ink(MX.ap(M, catmull([[mx - .04, my + .01], [mx, my + .035], [mx + .04, my + .01]], 4)), { closed: false, width: lw * .95, amp: .4, seed: sd + 71 });
  } else if (m === 'smile') {
    ink(MX.ap(M, catmull([[mx - .05, my], [mx, my + .04], [mx + .05, my]], 4)), { closed: false, width: lw, amp: .4, seed: sd + 71 });
  } else if (m === 'grin') {
    sh(MX.ap(M, [[mx - .07, my - .005], [mx + .07, my - .005], [mx + .045, my + .05], [mx, my + .065], [mx - .045, my + .05]]), { fill: PAL.rose, stroke: PAL.ink, w: lw * .85, amp: .4, tex: null, seed: sd + 74 });
  } else if (m === 'w') {
    ink(MX.ap(M, catmull([[mx - .06, my], [mx - .03, my + .032], [mx, my + .006], [mx + .03, my + .032], [mx + .06, my]], 3)), { closed: false, width: lw * .95, amp: .4, seed: sd + 72 });
  } else if (m === 'frown') {
    ink(MX.ap(M, catmull([[mx - .045, my + .035], [mx, my + .008], [mx + .045, my + .035]], 4)), { closed: false, width: lw * .95, amp: .4, seed: sd + 73 });
  }

  // accessories
  if (o.tag) {
    const tm = MX.chain(M, MX.T(.1, bodyTop + bodyH * .8), MX.R(-.08));
    const tw = .38, th = .16;
    sh(MX.ap(tm, rrectPts(-tw / 2, -th / 2, tw, th, .03, 3)), { fill: PAL.white, stroke: PAL.ink, w: lw * .7, amp: .5, tex: null, seed: sd + 80 });
    fillP(MX.ap(tm, rectPts(-tw / 2 + .01, -th / 2 + .01, tw - .02, th * .3)), PAL.red, { amp: .4, tex: null, seed: sd + 81 });
    ctx.save(); ctx.transform(...tm); ctx.scale(1 / s, 1 / s);
    hand(o.tag, 0, th * .36 * s, { size: s * .085, color: PAL.ink, jit: .4 });
    ctx.restore();
  }
  if (o.hat) drawHat(o.hat, M, bodyTop, lw, sd, s);
  for (const side of [-1, 1]) {
    const hand_ = side > 0 ? o.handR : o.handL; if (!hand_) continue;
    const hm = MX.mul(armM(side), MX.T(side * armW, 0));
    ctx.save(); ctx.transform(...hm); ctx.scale(1 / s, 1 / s); hand_(side); ctx.restore();
  }
  ctx.globalAlpha = ga0;
  return M;
}

function drawHat(kind, M, top, lw, sd, s) {
  const st = { stroke: PAL.ink, w: lw, amp: .9, seed: sd + 90 };
  const H_ = (m, pts, fill, e = {}) => sh(MX.ap(m, pts), Object.assign({ fill, tex: 'hatchL' }, st, e));
  if (kind === 'party') {
    const m = MX.chain(M, MX.T(.2, top + .01), MX.R(.2));
    H_(m, [[-.14, 0], [.14, 0], [0, -.4]], PAL.lav);
    for (let i = 0; i < 3; i++) { const [px, py] = MX.pt(m, -.05 + i * .045, -.07 - i * .1); dot(px, py, .022 * s, PAL.butter); }
    H_(m, ellPts(0, -.41, .05, .05, 12), PAL.butter, { tex: null });
  } else if (kind === 'beret') {
    const m = MX.chain(M, MX.T(-.05, top + .03), MX.R(-.12));
    H_(m, ellPts(0, -.04, .3, .09, 24), PAL.rose);
    ink(MX.ap(m, [[0, -.13], [.02, -.2]]), { closed: false, width: lw * 1.3, amp: .4 });
  } else if (kind === 'hard') {
    const m = MX.chain(M, MX.T(0, top + .02));
    const pts = []; for (let i = 0; i <= 16; i++) { const a = Math.PI + i / 16 * Math.PI; pts.push([Math.cos(a) * .3, Math.sin(a) * .21]); }
    H_(m, pts, PAL.butter);
    H_(m, rrectPts(-.38, -.03, .76, .06, .02, 2), PAL.gold, { tex: null });
  } else if (kind === 'cap') {
    const m = MX.chain(M, MX.T(0, top + .02));
    const pts = []; for (let i = 0; i <= 14; i++) { const a = Math.PI + i / 14 * Math.PI; pts.push([Math.cos(a) * .27, Math.sin(a) * .16]); }
    H_(m, pts, PAL.blue);
    H_(m, [[.12, -.02], [.46, -.01], [.42, .035], [.12, .025]], PAL.navy, { tex: null });
  } else if (kind === 'crown') {
    const m = MX.chain(M, MX.T(0, top + .01));
    H_(m, [[-.2, 0], [-.23, -.21], [-.1, -.1], [0, -.25], [.1, -.1], [.23, -.21], [.2, 0]], PAL.gold);
    const [px, py] = MX.pt(m, 0, -.07); dot(px, py, .026 * s, PAL.rose);
  } else if (kind === 'night') {
    const m = MX.chain(M, MX.T(.05, top + .02), MX.R(.25));
    H_(m, [[-.21, 0], [.21, 0], [.12, -.2], [.33, -.37], [0, -.25]], PAL.sky, { tex: 'dotsL', texA: .45 });
    H_(m, ellPts(.34, -.38, .045, .045, 12), PAL.white, { tex: null });
  } else if (kind === 'headphones') {
    const m = MX.chain(M, MX.T(0, top + .02));
    const arc = []; for (let i = 0; i <= 18; i++) { const a = Math.PI + i / 18 * Math.PI; arc.push([Math.cos(a) * .5, Math.sin(a) * .22]); }
    ink(MX.ap(m, arc), { closed: false, width: lw * 2.2, amp: .6, color: PAL.navy });
    H_(m, rrectPts(-.6, -.02, .16, .26, .05, 3), PAL.navy, { tex: null });
    H_(m, rrectPts(.44, -.02, .16, .26, .05, 3), PAL.navy, { tex: null });
  }
}

// floating z's for sleeping
function zzz(x, y, t, s = 40) {
  for (let i = 0; i < 3; i++) {
    const ph = ((t * .45 + i / 3) % 1);
    alpha(Math.sin(ph * Math.PI), () => hand('z', x + ph * s * 1.6 + Math.sin(ph * 6 + i) * 8, y - ph * s * 3, { size: s * (0.6 + ph * .8), color: PAL.lav, outline: PAL.ink, ow: 4, seed: i }));
  }
}

// beat-driven dance pose
function dancePose(t, amt = 1, o = {}) {
  const b = beatInfo(t); const hit = Math.exp(-7 * b.ph * b.per);
  const alt = (b.i % 2) ? 1 : -1;
  return Object.assign({
    squash: (hit * .13 - .03) * amt,
    lift: Math.max(0, Math.sin(b.ph * Math.PI)) * .13 * amt,
    armL: (.3 + (alt > 0 ? 1.0 : .15) * (1 - b.ph * .5)) * amt,
    armR: (.3 + (alt < 0 ? 1.0 : .15) * (1 - b.ph * .5)) * amt,
    rot: Math.sin((b.i + b.ph) * Math.PI) * .07 * amt,
    eyes: 'happy', mouth: 'grin',
  }, o);
}
function singMouth(t) { return clamp((band('mid', t) - .3) * 2.4); }
