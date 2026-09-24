/* LAWS Tracker — compact options for section 02 on the homepage (review).
   The full tracker lives on systems.html. Add ?systems=map or ?systems=classes to
   the homepage URL to replace the long grid with a short preview; without the
   parameter the homepage is unchanged. script.js calls window.LAWS_SECTION once
   data.json loads, before the tracker renders. */
(function () {
  'use strict';

  var MODE = (new URLSearchParams(location.search).get('systems') || '').toLowerCase();
  var STILL = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DWELL = 6000;   /* ms each region stays on screen */

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var icon = function (id) { return '<svg class="ico" aria-hidden="true"><use href="#' + id + '"/></svg>'; };

  window.LAWS_SECTION = function (DATA, api) {
    if (MODE !== 'map' && MODE !== 'classes') return;
    var sec = document.getElementById('explorer');
    if (!sec) return;
    sec.classList.add('explorer--compact');
    var box = sec.querySelector('.container');
    var total = DATA.systems.length;
    box.innerHTML =
      '<p class="kicker">02 — The systems</p>' +
      '<h2 class="h-display">The Systems.</h2>' +
      '<div class="s2"></div>' +
      '<a class="cta cta-dark" href="systems.html">Explore all ' + total + ' systems ' + icon('i-arrow') + '</a>';
    var s2 = box.querySelector('.s2');
    if (MODE === 'map') mapView(s2, DATA, api);
    else classView(s2, DATA, api);
    s2.addEventListener('click', function (e) {
      var b = e.target.closest('[data-open]');
      if (b) api.openDrawer(b.dataset.open);
    });
  };

  /* A small system tile: photo, name, origin, class. Opens the record. */
  function mini(s, api) {
    var img = (s.images || [])[0];
    var tc = 'var(--' + String(s.tier || 'b1').toLowerCase() + ')';
    return '<button type="button" class="mini" data-open="' + esc(s.id) + '" style="--tc:' + tc + '">' +
      '<span class="mini-img">' + (img ? '<img src="img/' + esc(img.file) + '" alt="" loading="lazy">' : '') + '</span>' +
      '<span class="mini-t"><span class="mini-name">' + esc(s.name) + '</span>' +
      '<span class="mini-meta"><b>' + esc(s.tier || '—') + '</b> ' + esc(s.origin || '') + '</span></span></button>';
  }

  /* Three systems per region, each shown at most once across the timeline so the
     stops do not repeat (Patriot and Phalanx are fielded almost everywhere). Within
     a region: corroborated combat use, then reported use, then how many of that
     region's countries field it, then a photograph. Smallest regions choose first. */
  function pickFeatured(stats, api) {
    var used = {};
    stats.slice().sort(function (a, b) { return a.list.length - b.list.length; }).forEach(function (st) {
      var local = function (s) {
        return (s.operators || []).filter(function (o) { return api.REGION_OF[o['Operator Country']] === st.region; }).length;
      };
      var score = function (s) {
        return (s.evidence === 'combat' ? 1000 : s.evidence === 'reported' ? 500 : 0) +
          local(s) * 10 + ((s.images || []).length ? 5 : 0);
      };
      var ranked = st.list.slice().sort(function (a, b) {
        return score(b) - score(a) || String(a.name).localeCompare(String(b.name));
      });
      var pick = ranked.filter(function (s) { return !used[s.id]; }).slice(0, 3);
      /* a region with too few unused systems falls back to repeats rather than gaps */
      ranked.forEach(function (s) { if (pick.length < 3 && pick.indexOf(s) < 0) pick.push(s); });
      pick.forEach(function (s) { used[s.id] = 1; });
      st.featured = pick;
    });
  }

  /* =====================================================================
     A — Map and region timeline. Autoplays one region every few seconds;
     arrows, the stops themselves and a pause button take over at any time.
     ===================================================================== */
  function mapView(el, DATA, api) {
    var ORDER = api.REGION_ORDER, S = DATA.systems;
    var stats = ORDER.map(function (r) {
      var list = S.filter(function (s) { return api.fieldedIn(s, r); });
      var countries = {};
      list.forEach(function (s) {
        (s.operators || []).forEach(function (o) {
          var c = o['Operator Country'];
          if (api.REGION_OF[c] === r) countries[c] = (countries[c] || 0) + 1;
        });
      });
      var names = Object.keys(countries).sort(function (a, b) { return countries[b] - countries[a] || a.localeCompare(b); });
      return { region: r, list: list, countries: names };
    });
    pickFeatured(stats, api);

    el.innerHTML =
      '<p class="lede measure s2-lede">Where they are fielded. Every region of the world now operates at least one of these systems.</p>' +
      '<div class="rg">' +
        '<div class="rg-map"><canvas aria-hidden="true"></canvas></div>' +
        '<div class="rg-panel" id="rg-panel"></div>' +
      '</div>' +
      '<div class="tl" role="group" aria-label="Regions">' +
        '<button type="button" class="tl-btn" data-step="-1" aria-label="Previous region">' + icon('i-arrow') + '</button>' +
        '<ol class="tl-stops">' + stats.map(function (st, i) {
          return '<li><button type="button" class="tl-stop" data-i="' + i + '" aria-controls="rg-panel">' +
            '<span class="tl-name">' + esc(st.region) + '</span><span class="tl-n">' + st.list.length + '</span>' +
            '<span class="tl-bar"><span></span></span></button></li>';
        }).join('') + '</ol>' +
        '<button type="button" class="tl-btn" data-step="1" aria-label="Next region">' + icon('i-arrow') + '</button>' +
        '<button type="button" class="tl-play" aria-label="Pause autoplay">' +
          '<span class="i-pause" aria-hidden="true"></span></button>' +
      '</div>';

    var panel = el.querySelector('.rg-panel');
    var stops = el.querySelectorAll('.tl-stop');
    var playBtn = el.querySelector('.tl-play');
    var canvas = el.querySelector('canvas');
    var draw = function () {};

    var idx = 0, playing = !STILL, hovering = false, visible = false, t0 = 0, raf = 0;

    function show(i, user) {
      idx = (i + stats.length) % stats.length;
      var st = stats[idx];
      var more = st.countries.length > 8 ? ' and ' + (st.countries.length - 8) + ' more' : '';
      panel.innerHTML =
        '<p class="rg-kicker">Fielded in</p>' +
        '<h3 class="rg-name">' + esc(st.region) + '</h3>' +
        '<p class="rg-stat"><b>' + st.list.length + '</b> system' + (st.list.length === 1 ? '' : 's') +
          '<span class="sep">·</span><b>' + st.countries.length + '</b> operator ' +
          (st.countries.length === 1 ? 'country' : 'countries') + '</p>' +
        '<p class="rg-countries">' + esc(st.countries.slice(0, 8).join(', ')) + esc(more) + '</p>' +
        '<div class="minis">' + st.featured.map(function (s) { return mini(s, api); }).join('') + '</div>' +
        '<a class="rg-all" href="systems.html?region=' + encodeURIComponent(st.region) + '">See all ' +
          st.list.length + ' fielded in ' + esc(st.region) + ' ' + icon('i-arrow') + '</a>';
      Array.prototype.forEach.call(stops, function (b, k) {
        b.setAttribute('aria-current', k === idx ? 'true' : 'false');
        b.querySelector('.tl-bar span').style.width = k < idx ? '100%' : '0%';
      });
      draw(st.region);
      t0 = performance.now();
      if (user) panel.setAttribute('aria-live', 'polite');   /* announce only what the user asked for */
      else panel.removeAttribute('aria-live');
    }

    /* The progress bar under the active stop doubles as the autoplay clock. */
    function tick(now) {
      raf = 0;
      var running = playing && !hovering && visible && !document.hidden;
      var bar = stops[idx].querySelector('.tl-bar span');
      if (running) {
        var p = Math.min(1, (now - t0) / DWELL);
        bar.style.width = (p * 100) + '%';
        if (p >= 1) show(idx + 1);
      } else {
        t0 = now - (parseFloat(bar.style.width) || 0) / 100 * DWELL;   /* resume where it paused */
      }
      raf = requestAnimationFrame(tick);
    }

    function setPlaying(on) {
      playing = on;
      playBtn.setAttribute('aria-label', on ? 'Pause autoplay' : 'Play autoplay');
      playBtn.firstChild.className = on ? 'i-pause' : 'i-play';
    }

    el.querySelector('.tl').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b === playBtn) { setPlaying(!playing); return; }
      /* Any manual step stops autoplay: the reader has taken over. */
      setPlaying(false);
      if (b.dataset.step) show(idx + Number(b.dataset.step), true);
      else if (b.dataset.i) show(Number(b.dataset.i), true);
    });
    var wrap = el;
    wrap.addEventListener('mouseenter', function () { hovering = true; });
    wrap.addEventListener('mouseleave', function () { hovering = false; });
    wrap.addEventListener('focusin', function () { hovering = true; });
    wrap.addEventListener('focusout', function () { hovering = false; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0.35 }).observe(el);
    } else visible = true;

    setPlaying(playing);
    show(0);
    raf = requestAnimationFrame(tick);   /* idles until playing; reduced motion starts paused */

    /* ---- the map: an equirectangular dot grid from globe.json ---- */
    fetch('globe.json?v=1').then(function (r) { return r.json(); }).then(function (G) {
      var ctx = canvas.getContext('2d');
      var ATLAS = { 'United States': 'United States of America', 'Libya (GNA)': 'Libya' };
      var regionOfAtlas = {}, operators = {};
      Object.keys(api.REGION_OF).forEach(function (c) { regionOfAtlas[ATLAS[c] || c] = api.REGION_OF[c]; });
      S.forEach(function (s) { (s.operators || []).forEach(function (o) { operators[ATLAS[o['Operator Country']] || o['Operator Country']] = 1; }); });
      var LAT_T = 80, LAT_B = -58, LON_L = -170, LON_R = 190;
      var dots = G.dots.map(function (d) {
        var n = G.names[d[2]], lon = d[0] < LON_L ? d[0] + 360 : d[0];
        return { lon: lon, lat: d[1], op: !!operators[n], region: regionOfAtlas[n] };
      });
      var W = 0, H = 0, dpr = 1, from = null, to = null, fadeStart = 0;
      function size() {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = canvas.clientWidth; H = W * (LAT_T - LAT_B) / (LON_R - LON_L);
        canvas.style.height = H + 'px';
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        paint(1);
      }
      function colour(d, region) {
        if (d.region === region && d.op) return [214, 35, 77, 1];
        if (d.op) return [233, 138, 160, 0.42];
        return [154, 166, 196, 0.2];
      }
      function paint(t) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        var step = W / 225, sz = Math.max(1.4, step * 0.62);
        for (var i = 0; i < dots.length; i++) {
          var d = dots[i];
          var a = colour(d, from), b = colour(d, to);
          var c = a.map(function (v, k) { return v + (b[k] - v) * t; });
          ctx.fillStyle = 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + c[3].toFixed(3) + ')';
          var x = (d.lon - LON_L) / (LON_R - LON_L) * W, y = (LAT_T - d.lat) / (LAT_T - LAT_B) * H;
          var s = (d.region === to && d.op) ? sz * (1 + 0.35 * t) : sz;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
      draw = function (region) {
        from = to; to = region; fadeStart = performance.now();
        if (STILL || from === null) { paint(1); return; }
        (function fade(now) {
          var t = Math.min(1, (now - fadeStart) / 600);
          paint(1 - Math.pow(1 - t, 3));
          if (t < 1) requestAnimationFrame(fade);
        })(fadeStart);
      };
      to = stats[idx].region;
      size();
      window.addEventListener('resize', size);
    });
  }

  /* =====================================================================
     B — By autonomy class. Four columns, the site's central argument: what
     separates these systems is where human judgement drops out.
     ===================================================================== */
  function classView(el, DATA, api) {
    var ORDER = ['A1', 'A2', 'A3', 'B1'], S = DATA.systems;
    el.innerHTML =
      '<p class="lede measure s2-lede">Grouped by where human judgement drops out of the kill chain — from systems no one supervises to those that only finish what a human started.</p>' +
      '<div class="cls">' + ORDER.map(function (t) {
        var T = api.TIERS[t], list = S.filter(function (s) { return s.tier === t; });
        return '<article class="cl" style="--tc:var(--' + t.toLowerCase() + ')">' +
          '<header class="cl-head"><span class="cl-code">' + t + '</span><span class="cl-n">' + list.length + '</span></header>' +
          '<h3 class="cl-name">' + T.name + '</h3>' +
          '<p class="cl-desc">' + T.desc + '</p>' +
          '<div class="minis">' + api.featured(list, 3).map(function (s) { return mini(s, api); }).join('') + '</div>' +
          '<a class="rg-all" href="systems.html?tier=' + t + '">See all ' + list.length + ' ' + t + ' systems ' + icon('i-arrow') + '</a>' +
        '</article>';
      }).join('') + '</div>';
  }
})();
