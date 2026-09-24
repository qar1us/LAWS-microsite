/* LAWS Tracker — alternative hero treatments for review.
   The default hero is unchanged. Add ?hero=globe or ?hero=units to the URL to see
   an alternative (review.js draws the switcher). script.js calls window.LAWS_HERO
   once data.json loads. */
(function () {
  'use strict';

  var MODE = (new URLSearchParams(location.search).get('hero') || '').toLowerCase();
  var STILL = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.LAWS_HERO = function (DATA, api) {
    var hero = document.querySelector('.hero');
    if (!hero) return;
    if (MODE === 'globe') globe(hero, DATA);
    else if (MODE === 'units') units(hero, DATA, api);
  };

  /* Two-column hero: copy and stats on the left, the visual on the right. */
  function stage(hero, cls) {
    hero.classList.add('hero--alt', cls);
    var inner = hero.querySelector('.hero-inner');
    var viz = document.createElement('div');
    viz.className = 'hero-viz';
    inner.appendChild(viz);
    return viz;
  }

  /* =====================================================================
     B — Globe. Land as a dot grid; producing states in crimson, operator
     states in a pale tint, and arcs tracing export pairs from the dataset.
     ===================================================================== */

  /* Dataset country names that differ from Natural Earth's. */
  var ATLAS_NAME = { 'United States': 'United States of America', 'Libya (GNA)': 'Libya' };
  var atlas = function (n) { return ATLAS_NAME[n] || n; };
  var splitOrigin = function (o) { return String(o || '').split(/\s*\/\s*/).filter(Boolean); };

  function globe(hero, DATA) {
    var viz = stage(hero, 'hero--globe');
    viz.innerHTML =
      '<canvas class="globe" aria-hidden="true"></canvas>' +
      '<p class="globe-key"><span class="k-origin">Build them</span><span class="k-op">Field them</span></p>';
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
      pairs = Object.keys(pairs).map(function (k) { return pairs[k]; })
        .filter(function (p) { return G.centroids[p[0]] && G.centroids[p[1]]; });

      var RAD = Math.PI / 180;
      var vec = function (lon, lat) {
        lon *= RAD; lat *= RAD;
        return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
      };
      /* Pre-convert every dot to a unit vector once; each frame only rotates. */
      var dots = G.dots.map(function (d) {
        var n = G.names[d[2]];
        return { v: vec(d[0], d[1]), k: origins[n] ? 2 : operators[n] ? 1 : 0 };
      });
      var marks = Object.keys(origins).filter(function (n) { return G.centroids[n]; })
        .map(function (n) { return vec(G.centroids[n][0], G.centroids[n][1]); });

      var W = 0, R = 0, dpr = 1;
      function size() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = canvas.clientWidth;
        canvas.width = canvas.height = Math.round(W * dpr);
        R = W * 0.46;
      }
      size();
      window.addEventListener('resize', size);

      var TILT = 22 * RAD;               /* view centred slightly north */
      var lon0 = -20;                    /* start over the Atlantic, Europe in view */
      function rotate(v, rot) {
        /* spin about the pole, then tilt towards the viewer */
        var c = Math.cos(rot), s = Math.sin(rot);
        var x = v[0] * c + v[2] * s, z = -v[0] * s + v[2] * c, y = v[1];
        var ct = Math.cos(TILT), st = Math.sin(TILT);
        return [x, y * ct - z * st, y * st + z * ct];
      }
      function slerp(a, b, t) {
        var d = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
        if (d < 1e-6) return a;
        var sa = Math.sin((1 - t) * d) / Math.sin(d), sb = Math.sin(t * d) / Math.sin(d);
        return [a[0] * sa + b[0] * sb, a[1] * sa + b[1] * sb, a[2] * sa + b[2] * sb];
      }

      var arcs = [], lastSpawn = 0, cursor = 0;
      /* Deterministic shuffle so the sequence varies but screenshots are stable. */
      pairs.sort(function (a, b) { return hash(a.join()) - hash(b.join()); });
      function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

      function spawn(now) {
        var p = pairs[cursor++ % pairs.length];
        var a = vec(G.centroids[p[0]][0], G.centroids[p[0]][1]);
        var b = vec(G.centroids[p[1]][0], G.centroids[p[1]][1]);
        var ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
        arcs.push({ a: a, b: b, lift: 0.06 + ang * 0.1, t0: now });
      }

      function draw(now) {
        var rot = (lon0 + (STILL ? 0 : now * 0.004)) * RAD;
        var cx = W / 2, cy = W / 2;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, W);

        /* sphere body and rim */
        var g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
        g.addColorStop(0, '#1a2358'); g.addColorStop(1, '#0b1030');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(214,35,77,0.35)'; ctx.lineWidth = 1; ctx.stroke();

        /* land dots, front hemisphere only; size and alpha fall off at the limb */
        var COL = ['154,166,196', '233,138,160', '214,35,77'];
        for (var i = 0; i < dots.length; i++) {
          var p = rotate(dots[i].v, rot);
          if (p[2] <= 0) continue;
          var k = dots[i].k, sz = (k === 2 ? 2.4 : 1.7) * (0.55 + 0.45 * p[2]);
          ctx.fillStyle = 'rgba(' + COL[k] + ',' + ((k ? 0.55 : 0.28) + 0.45 * p[2]).toFixed(3) + ')';
          ctx.fillRect(cx + p[0] * R - sz / 2, cy - p[1] * R - sz / 2, sz, sz);
        }

        /* producing-state beacons */
        var pulse = STILL ? 0.5 : (now / 1400) % 1;
        marks.forEach(function (m) {
          var p = rotate(m, rot);
          if (p[2] <= 0.05) return;
          var x = cx + p[0] * R, y = cy - p[1] * R;
          ctx.strokeStyle = 'rgba(214,35,77,' + (0.7 * (1 - pulse) * p[2]).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(x, y, 3 + pulse * 11, 0, Math.PI * 2); ctx.stroke();
        });

        /* export arcs: grow, hold, fade */
        if (STILL) {
          if (!arcs.length) for (var n = 0; n < 14; n++) spawn(-1e9);
        } else if (now - lastSpawn > 380) { spawn(now); lastSpawn = now; }
        arcs = arcs.filter(function (A) { return STILL || now - A.t0 < 3200; });
        arcs.forEach(function (A) {
          var age = STILL ? 2000 : now - A.t0;
          var grow = Math.min(1, age / 1300);
          var fade = age > 2300 ? 1 - (age - 2300) / 900 : 1;
          ctx.lineWidth = 1.3;
          var prev = null;
          for (var s = 0; s <= 40; s++) {
            var t = s / 40 * grow;
            var v = slerp(A.a, A.b, t), h = 1 + A.lift * Math.sin(Math.PI * t);
            var p = rotate([v[0] * h, v[1] * h, v[2] * h], rot);
            var x = cx + p[0] * R, y = cy - p[1] * R;
            /* visible if on the near side, or lifted clear of the disc's edge */
            var vis = p[2] > 0 || (p[0] * p[0] + p[1] * p[1]) > 1;
            if (prev && vis && prev.vis) {
              ctx.strokeStyle = 'rgba(255,196,208,' + (0.85 * fade * (0.35 + 0.65 * t / Math.max(grow, 0.01))).toFixed(3) + ')';
              ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(x, y); ctx.stroke();
            }
            prev = { x: x, y: y, vis: vis };
          }
          if (prev && prev.vis && grow < 1) {
            ctx.fillStyle = 'rgba(255,255,255,' + fade.toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(prev.x, prev.y, 2, 0, Math.PI * 2); ctx.fill();
          }
        });
      }

      if (STILL) { draw(0); window.addEventListener('resize', function () { draw(0); }); return; }

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

  /* =====================================================================
     C — Units. One square per system, grouped by autonomy class, dealt in on
     load. Clicking a square opens that system's record.
     ===================================================================== */
  function units(hero, DATA, api) {
    var viz = stage(hero, 'hero--units');
    var ORDER = ['A1', 'A2', 'A3', 'B1'];
    var NAMES = { A1: 'Unsupervised select & engage', A2: 'Supervised, abort-capable',
                  A3: 'Bounded by a preset envelope', B1: 'Engagement completion only' };
    var i = 0;
    /* Decorative for assistive tech: the tracker below lists the same systems. */
    viz.innerHTML = '<div class="units" aria-hidden="true">' + ORDER.map(function (t) {
      var list = DATA.systems.filter(function (s) { return s.tier === t; });
      return '<div class="u-group" style="--tc:var(--' + t.toLowerCase() + ')">' +
        '<p class="u-head"><b>' + t + '</b> ' + NAMES[t] + '<span class="u-n">' + list.length + '</span></p>' +
        '<div class="u-grid">' + list.map(function (s) {
          return '<button type="button" class="u" tabindex="-1" data-id="' + s.id + '" title="' +
            String(s.name).replace(/"/g, '&quot;') + '" style="--d:' + (i++ * 16) + 'ms"></button>';
        }).join('') + '</div></div>';
    }).join('') + '<p class="u-cap">Each square is one system. Select one to open its record.</p></div>';

    viz.addEventListener('click', function (e) {
      var u = e.target.closest('.u');
      if (u && api && api.openDrawer) api.openDrawer(u.dataset.id);
    });
    /* start the deal once layout is settled */
    requestAnimationFrame(function () { viz.classList.add('is-in'); });
  }
})();
