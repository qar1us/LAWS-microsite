/* LAWS Tracker — globe hero (chosen in the V3 review).
   Land as a dot grid; producing states in crimson, operator states in a pale tint.
   Every cross-border export pair in data.json is drawn once as a faint, low line
   that never moves; the motion is carried by soft dots drifting along those lines
   and a slow twinkle across operator states — deliberately nothing that reads as
   a trajectory. script.js calls window.LAWS_HERO once data.json loads. */
(function () {
  'use strict';

  var STILL = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Dataset country names that differ from Natural Earth's. */
  var ATLAS_NAME = { 'United States': 'United States of America', 'Libya (GNA)': 'Libya' };
  var atlas = function (n) { return ATLAS_NAME[n] || n; };
  var splitOrigin = function (o) { return String(o || '').split(/\s*\/\s*/).filter(Boolean); };

  window.LAWS_HERO = function (DATA) {
    var hero = document.querySelector('.hero');
    if (hero) globe(hero, DATA);
  };

  function globe(hero, DATA) {
    /* Two-column hero: copy and stats on the left, the globe on the right. */
    hero.classList.add('hero--alt', 'hero--globe');
    var viz = document.createElement('div');
    viz.className = 'hero-viz';
    viz.innerHTML = '<canvas class="globe" aria-hidden="true"></canvas>';
    hero.querySelector('.hero-inner').appendChild(viz);
    var canvas = viz.querySelector('canvas');
    var ctx = canvas.getContext('2d');

    fetch('globe.json?v=1').then(function (r) { return r.json(); }).then(function (G) {
      /* Who builds, who fields, and every cross-border pair, all from data.json. */
      var origins = {}, operators = {}, pairs = {};
      DATA.systems.forEach(function (s) {
        var from = splitOrigin(s.origin).map(atlas);
        from.forEach(function (o) { origins[o] = 1; });
        (s.operators || []).forEach(function (op) {
          var to = atlas(op['Operator Country']);
          if (!to) return;
          operators[to] = 1;
          from.forEach(function (o) { if (o !== to) pairs[o + '>' + to] = [o, to]; });
        });
      });

      var RAD = Math.PI / 180;
      var vec = function (ll) {
        var lon = ll[0] * RAD, lat = ll[1] * RAD;
        return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
      };
      function slerp(a, b, t) {
        var d = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
        if (d < 1e-6) return a;
        var sa = Math.sin((1 - t) * d) / Math.sin(d), sb = Math.sin(t * d) / Math.sin(d);
        return [a[0] * sa + b[0] * sb, a[1] * sa + b[1] * sb, a[2] * sa + b[2] * sb];
      }

      /* Land dots as unit vectors, once. Operator-state dots get a twinkle phase. */
      var dots = G.dots.map(function (d, i) {
        var n = G.names[d[2]];
        return { v: vec(d), k: origins[n] ? 2 : operators[n] ? 1 : 0, ph: (i * 2.399) % (Math.PI * 2) };
      });

      /* Each route is sampled once into 3D points, lifted only slightly off the
         surface: a low line reads as a connection, a high arc as a flight path. */
      var SEG = 28;
      var routes = Object.keys(pairs).map(function (k) { return pairs[k]; })
        .filter(function (p) { return G.centroids[p[0]] && G.centroids[p[1]]; })
        .map(function (p, i) {
          var a = vec(G.centroids[p[0]]), b = vec(G.centroids[p[1]]);
          var ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
          var lift = 0.01 + ang * 0.02, pts = [];
          for (var s = 0; s <= SEG; s++) {
            var v = slerp(a, b, s / SEG), h = 1 + lift * Math.sin(Math.PI * s / SEG);
            pts.push([v[0] * h, v[1] * h, v[2] * h]);
          }
          /* one drifting dot per route, staggered so they never move in step */
          return { pts: pts, phase: (i * 0.618) % 1, speed: 1 / (9000 + (i % 7) * 900) };
        });

      var W = 0, R = 0, dpr = 1;
      function size() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = canvas.clientWidth;
        canvas.width = canvas.height = Math.round(W * dpr);
        R = W * 0.46;
      }
      size();
      window.addEventListener('resize', function () { size(); if (STILL) draw(0); });

      var TILT = 22 * RAD;               /* view centered slightly north */
      var LON0 = -20;                    /* start over the Atlantic, Europe in view */
      function project(v, rot) {
        /* spin about the pole, then tilt towards the viewer */
        var c = Math.cos(rot), s = Math.sin(rot);
        var x = v[0] * c + v[2] * s, z = -v[0] * s + v[2] * c, y = v[1];
        var ct = Math.cos(TILT), st = Math.sin(TILT);
        var p = [x, y * ct - z * st, y * st + z * ct];
        /* only the near hemisphere is drawn, so nothing floats off the globe's edge */
        return { x: W / 2 + p[0] * R, y: W / 2 - p[1] * R, z: p[2], vis: p[2] > 0.04 };
      }

      function draw(now) {
        var rot = (LON0 + (STILL ? 0 : now * 0.004)) * RAD;
        var cx = W / 2, cy = W / 2;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, W);

        /* sphere body and rim */
        var g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
        g.addColorStop(0, '#1a2358'); g.addColorStop(1, '#0b1030');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(214,35,77,0.3)'; ctx.lineWidth = 1; ctx.stroke();

        /* land: size and alpha fall off at the limb; operator states twinkle */
        var COL = ['154,166,196', '233,138,160', '214,35,77'];
        for (var i = 0; i < dots.length; i++) {
          var d = dots[i], p = project(d.v, rot);
          if (p.z <= 0) continue;
          var tw = d.k === 1 && !STILL ? 0.75 + 0.25 * Math.sin(now / 900 + d.ph) : 1;
          var sz = (d.k === 2 ? 2.4 : 1.7) * (0.55 + 0.45 * p.z);
          ctx.fillStyle = 'rgba(' + COL[d.k] + ',' + (((d.k ? 0.55 : 0.28) + 0.45 * p.z) * tw).toFixed(3) + ')';
          ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
        }

        /* static routes */
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(255,196,208,0.11)';
        ctx.beginPath();
        routes.forEach(function (rt) {
          var prev = null;
          rt.pts.forEach(function (v) {
            var p = project(v, rot);
            if (prev && p.vis && prev.vis) { ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); }
            prev = p;
          });
        });
        ctx.stroke();

        /* drifting dots: soft, no trail, fading in and out at each end */
        if (STILL) return;
        routes.forEach(function (rt) {
          var t = (rt.phase + now * rt.speed) % 1;
          var f = t * SEG, k = Math.floor(f), a = rt.pts[k], b = rt.pts[Math.min(SEG, k + 1)], u = f - k;
          var p = project([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u], rot);
          if (!p.vis) return;
          var alpha = Math.sin(Math.PI * t) * 0.85;
          var grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 3.2);
          grd.addColorStop(0, 'rgba(255,214,222,' + alpha.toFixed(3) + ')');
          grd.addColorStop(1, 'rgba(255,214,222,0)');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill();
        });
      }

      if (STILL) { draw(0); return; }

      /* Only animate while the hero is on screen and the tab is visible. */
      var running = false, onScreen = true;
      function loop(now) { if (!running) return; draw(now); requestAnimationFrame(loop); }
      function update() {
        var go = onScreen && !document.hidden;
        if (go && !running) { running = true; requestAnimationFrame(loop); }
        if (!go) running = false;
      }
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; update(); }).observe(hero);
      }
      document.addEventListener('visibilitychange', update);
      update();
    });
  }
})();
