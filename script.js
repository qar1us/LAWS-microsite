/* LAWS Tracker — rendering and filtering.
   All content is driven from data.json, generated from LAWS_Dataset_V1.xlsx
   by tools/build_data.py. Nothing here hardcodes system facts. */
(function () {
  'use strict';

  var TIERS = {
    A1: { name: 'Unsupervised select &amp; engage', color: 'var(--a1)',
          desc: 'After activation the system selects and engages a target with no human meaningfully supervising or able to intervene.' },
    A2: { name: 'Supervised, abort-capable', color: 'var(--a2)',
          desc: 'The system selects and engages independently while a human supervises with a real, technically available opportunity to abort.' },
    A3: { name: 'Bounded by a preset envelope', color: 'var(--a3)',
          desc: 'Independent selection and engagement, but only inside a tightly predefined geographic, temporal or target-profile envelope.' },
    B1: { name: 'Engagement completion only', color: 'var(--b1)',
          desc: 'A human selects the target; the system then tracks and completes the engagement unaided, including after link loss.' }
  };
  var TIER_ORDER = ['A1', 'A2', 'A3', 'B1'];

  var DOMAIN_ICON = {
    'Air': 'i-air', 'Land': 'i-land', 'Sea': 'i-sea',
    'Undersea': 'i-undersea', 'Multi-domain': 'i-multi'
  };

  var LEVEL_CLASS = {
    'Autonomous': 'lv-auto',
    'Human-on-the-loop': 'lv-on',
    'Human-in-the-loop': 'lv-in',
    'Not present': 'lv-none',
    'Unknown': 'lv-unk'
  };

  var DATA = null, SYSTEMS = [], FILTERS = { domain: null, tier: null, origin: null, combat: false }, Q = '';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var tint = function (tier) {
    var t = { A1: 'rgba(214,35,77,0.45)', A2: 'rgba(226,104,63,0.38)',
              A3: 'rgba(224,166,60,0.32)', B1: 'rgba(111,139,150,0.34)' };
    return t[tier] || 'rgba(111,139,150,0.3)';
  };
  var hasCombat = function (s) {
    return !!s.effects && !/^\s*(none|no\s+(confirmed|public|known|recorded)|not\s+(yet\s+)?(used|employed|confirmed)|unknown|n\/?a)\b/i.test(s.effects);
  };
  var icon = function (id, cls) {
    return '<svg class="ico ' + (cls || '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  };

  /* ---------- boot ---------- */
  fetch('data.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (d) {
      DATA = d;
      SYSTEMS = d.systems;
      renderStats();
      renderTiers();
      renderFilters();
      renderGrid();
      renderBars();
      renderExcluded();
      wire();
    })
    .catch(function (e) {
      var g = $('#grid');
      if (g) g.innerHTML = '<p class="empty">Could not load data.json (' + esc(e.message) +
        '). This page must be served over HTTP — open it with a local server, not the file system.</p>';
    });

  /* ---------- hero stats ---------- */
  function renderStats() {
    var c = DATA.counts;
    var noApproval = SYSTEMS.filter(function (s) { return s.tier !== 'B1'; }).length;
    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set('stat-systems', c.systems);
    set('stat-origins', c.originCountries);
    set('stat-ops', c.operatorCountries);
    set('s-systems', c.systems);
    set('s-combat', c.withCombatEvidence);
    set('s-nohuman', noApproval);
    set('s-ops', c.operatorCountries);
  }

  /* ---------- tier cards ---------- */
  function renderTiers() {
    var counts = DATA.counts.byTier || {};
    var max = Math.max.apply(null, TIER_ORDER.map(function (t) { return counts[t] || 0; }));
    $('#tier-cards').innerHTML = TIER_ORDER.map(function (t) {
      var n = counts[t] || 0;
      return '<div class="tier" style="--tc:' + TIERS[t].color + '">' +
        '<span class="tier-n">' + n + '</span>' +
        '<span class="tier-code">' + t + '</span>' +
        '<p class="tier-name">' + TIERS[t].name + '</p>' +
        '<p class="tier-desc">' + TIERS[t].desc + '</p>' +
        '<div class="tier-meter"><span style="width:' + (max ? (n / max * 100) : 0) + '%"></span></div>' +
        '</div>';
    }).join('');
  }

  /* ---------- filters ---------- */
  function tally(key) {
    var m = {};
    SYSTEMS.forEach(function (s) { if (s[key]) m[s[key]] = (m[s[key]] || 0) + 1; });
    return m;
  }

  function renderFilters() {
    var dom = tally('domain'), org = tally('origin');
    var topOrigins = Object.keys(org).sort(function (a, b) { return org[b] - org[a]; }).slice(0, 8);

    var html = '';
    html += '<div class="fgroup"><span class="flabel">Domain</span>' +
      Object.keys(DOMAIN_ICON).filter(function (d) { return dom[d]; }).map(function (d) {
        return '<button class="chip" type="button" data-f="domain" data-v="' + esc(d) + '" aria-pressed="false">' +
          icon(DOMAIN_ICON[d]) + esc(d) + ' <span class="n">' + dom[d] + '</span></button>';
      }).join('') + '</div>';

    html += '<div class="fgroup"><span class="flabel">Autonomy</span>' +
      TIER_ORDER.map(function (t) {
        var n = (DATA.counts.byTier || {})[t] || 0;
        return '<button class="chip" type="button" data-f="tier" data-v="' + t + '" aria-pressed="false">' +
          t + ' <span class="n">' + n + '</span></button>';
      }).join('') + '</div>';

    html += '<div class="fgroup"><span class="flabel">Origin</span>' +
      topOrigins.map(function (o) {
        return '<button class="chip" type="button" data-f="origin" data-v="' + esc(o) + '" aria-pressed="false">' +
          esc(o) + ' <span class="n">' + org[o] + '</span></button>';
      }).join('') + '</div>';

    html += '<div class="fgroup"><span class="flabel">Evidence</span>' +
      '<button class="chip" type="button" data-f="combat" data-v="1" aria-pressed="false">' +
      icon('i-combat') + 'Confirmed combat use <span class="n">' + DATA.counts.withCombatEvidence + '</span></button></div>';

    $('#filters').innerHTML = html;
  }

  /* ---------- grid ---------- */
  function visible() {
    var q = Q.trim().toLowerCase();
    return SYSTEMS.filter(function (s) {
      if (FILTERS.domain && s.domain !== FILTERS.domain) return false;
      if (FILTERS.tier && s.tier !== FILTERS.tier) return false;
      if (FILTERS.origin && s.origin !== FILTERS.origin) return false;
      if (FILTERS.combat && !hasCombat(s)) return false;
      if (!q) return true;
      return [s.id, s.name, s.family, s.manufacturer, s.developer, s.origin,
              s.domain, s.theater, s.targets, (s.purposes || []).join(' ')]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  function cardHTML(s) {
    var img = (s.images || [])[0];
    var tc = (TIERS[s.tier] || {}).color || 'var(--b1)';
    var style = '--tc:' + tc + ';--tint:' + tint(s.tier);
    var media = img
      ? '<div class="card-img"><img src="img/' + esc(img.file) + '" alt="" loading="lazy" decoding="async"></div>'
      : '<div class="card-img is-empty">' + icon(DOMAIN_ICON[s.domain] || 'i-multi') + '</div>';

    var meta = [s.origin, s.manufacturer].filter(Boolean).map(esc).join(' <span class="sep">/</span> ');

    var flags = '';
    if (hasCombat(s)) flags += '<span class="flag on">' + icon('i-combat') + 'combat</span>';
    if (s.tier && s.tier !== 'B1') flags += '<span class="flag">' + icon('i-human') + 'no per-engagement approval</span>';
    if (s.confidence) flags += '<span class="flag">' + esc(s.confidence) + '</span>';

    return '<button class="card" type="button" data-id="' + esc(s.id) + '" style="' + style + '">' +
      media +
      '<span class="card-tier">' + esc(s.tier || '—') + '</span>' +
      '<span class="card-dom">' + icon(DOMAIN_ICON[s.domain] || 'i-multi') + '</span>' +
      '<span class="card-head"><span class="card-name">' + esc(s.name) + '</span>' +
      '<span class="card-id">' + esc(s.id) + '</span></span>' +
      '<span class="card-body"><span class="card-meta">' + meta + '</span>' +
      '<span class="card-flags">' + flags + '</span></span>' +
      '</button>';
  }

  function renderGrid() {
    var list = visible();
    $('#grid').innerHTML = list.map(cardHTML).join('');
    $('#empty').hidden = list.length > 0;
    $('#count').textContent = list.length === SYSTEMS.length
      ? SYSTEMS.length + ' systems'
      : list.length + ' of ' + SYSTEMS.length + ' systems';
    var any = FILTERS.domain || FILTERS.tier || FILTERS.origin || FILTERS.combat || Q;
    $('#reset').hidden = !any;
  }

  /* ---------- bars ---------- */
  function barBlock(el, entries, color) {
    var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }));
    el.innerHTML = entries.map(function (e) {
      var c = typeof color === 'function' ? color(e[0]) : color;
      return '<div class="bar"><span class="bar-l">' + esc(e[0]) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + (e[1] / max * 100) + '%;--bc:' + c + '"></span></span>' +
        '<span class="bar-n">' + e[1] + '</span></div>';
    }).join('');
  }

  function renderBars() {
    var org = tally('origin');
    barBlock($('#bars-origin'),
      Object.keys(org).map(function (k) { return [k, org[k]]; })
        .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10),
      'var(--ink)');

    var opc = {};
    SYSTEMS.forEach(function (s) {
      var seen = {};
      (s.operators || []).forEach(function (o) {
        var c = o['Operator Country'];
        if (c && !seen[c]) { seen[c] = 1; opc[c] = (opc[c] || 0) + 1; }
      });
    });
    barBlock($('#bars-operator'),
      Object.keys(opc).map(function (k) { return [k, opc[k]]; })
        .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10),
      'var(--slate)');

    var dm = DATA.counts.byDomain;
    barBlock($('#bars-domain'),
      Object.keys(dm).map(function (k) { return [k, dm[k]]; }).sort(function (a, b) { return b[1] - a[1]; }),
      'var(--ink)');

    var tb = DATA.counts.byTier;
    barBlock($('#bars-tier'),
      TIER_ORDER.filter(function (t) { return tb[t]; }).map(function (t) { return [t + ' — ' + TIERS[t].name.replace(/&amp;/g, '&'), tb[t]]; }),
      function (label) { return TIERS[label.slice(0, 2)].color; });
  }

  /* ---------- excluded annex ---------- */
  function renderExcluded() {
    var ex = DATA.excluded || [];
    $('#excl-count').textContent = '(' + ex.length + ')';
    $('#excl-grid').innerHTML = ex.map(function (e) {
      return '<div class="excl"><b>' + esc(e['System / Programme']) + '</b>' +
        '<div class="cat">' + esc(e['Country'] || '') + (e['Category'] ? ' · ' + esc(e['Category']) : '') + '</div>' +
        '<p>' + esc(e['Exclusion Rationale'] || '') + '</p></div>';
    }).join('');
  }

  /* ---------- detail drawer ---------- */
  function fieldRows(s) {
    var rows = [
      ['Family', s.family], ['Variant', s.variant],
      ['Manufacturer', s.manufacturer], ['Developer', s.developer],
      ['Origin', s.origin], ['Domain', s.domain],
      ['Reuse', s.reuse], ['Effect', s.effect],
      ['Authorization', s.auth], ['Supervision', s.supervision],
      ['Engagement envelope', s.envelope],
      ['Development', s.devStatus], ['Fielding', s.fieldStatus],
      ['Operational since', s.ocDate], ['Theater', s.theater],
      ['Targets', s.targets], ['Confirmed effects', s.effects],
      ['Confidence', s.confidenceRaw || s.confidence]
    ].filter(function (r) { return r[1]; });
    return '<dl class="dl">' + rows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
    }).join('') + '</dl>';
  }

  function matrixHTML(s) {
    var f = s.functions || {};
    var present = DATA.functionOrder.filter(function (k) { return f[k]; });
    if (!present.length) return '';
    return '<h3 class="h-sub">Autonomy by function</h3><div class="fmatrix">' +
      present.map(function (k) {
        var v = f[k];
        return '<div class="frow"><span class="frow-l">' + esc(k) + '</span>' +
          '<span><span class="frow-v ' + (LEVEL_CLASS[v] || 'lv-unk') + '">' + esc(v) + '</span></span></div>';
      }).join('') + '</div>';
  }

  function galleryHTML(s) {
    var imgs = s.images || [];
    if (!imgs.length) return '';
    return '<h3 class="h-sub">Imagery</h3><div class="gallery">' + imgs.map(function (im) {
      var cred = im.sourceDomain
        ? '<a href="' + esc(im.sourceUrl) + '" target="_blank" rel="noopener">' + esc(im.sourceDomain) + '</a>'
        : 'no source recorded';
      return '<div class="gitem">' +
        (im.status === 'hold' ? '<span class="ghold">rights: hold</span>' : '') +
        '<img src="img/' + esc(im.file) + '" alt="' + esc(s.name) + '" loading="lazy" decoding="async">' +
        '<span class="gcred">' + cred + '</span></div>';
    }).join('') + '</div>';
  }

  function sourcesHTML(s) {
    var src = s.sources || {}, keys = Object.keys(src);
    if (!keys.length) return '';
    return '<h3 class="h-sub">Sources by claim</h3><div class="srclist">' + keys.map(function (k) {
      var v = String(src[k]);
      var body = /^https?:\/\//.test(v)
        ? '<a href="' + esc(v) + '" target="_blank" rel="noopener">' + esc(v) + '</a>'
        : esc(v);
      return '<div><dt>' + esc(k) + '</dt>' + body + '</div>';
    }).join('') + '</div>';
  }

  function openDrawer(id) {
    var s = SYSTEMS.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    var t = TIERS[s.tier] || {};
    var img = (s.images || [])[0];
    var style = '--tc:' + (t.color || 'var(--b1)') + ';--tint:' + tint(s.tier);

    var hero = img
      ? '<div class="d-hero" style="' + style + '"><img src="img/' + esc(img.file) + '" alt="">'
      : '<div class="d-hero is-empty" style="' + style + '">';

    var html = hero +
      '<div class="d-badges"><span class="d-badge">' + esc(s.tier || '—') + '</span>' +
      (s.domain ? '<span class="d-badge alt">' + esc(s.domain) + '</span>' : '') + '</div>' +
      '<div class="d-head"><h2 id="d-name">' + esc(s.name) + '</h2>' +
      '<div class="d-id">' + esc(s.id) + '</div></div></div>' +
      '<div class="d-body" style="' + style + '">' +
      (t.name ? '<div class="d-tier"><b>' + s.tier + ' — ' + t.name + '.</b> ' + t.desc + '</div>' : '') +
      (s.tierCaveat ? '<div class="note"><b>Analyst caveat:</b> ' + esc(s.tierCaveat) + '</div>' : '') +
      ((s.purposes || []).length
        ? '<h3 class="h-sub">Operational purpose</h3><div class="pills">' +
          s.purposes.map(function (p) { return '<span class="pill">' + esc(p) + '</span>'; }).join('') + '</div>'
        : '') +
      '<h3 class="h-sub">Record</h3>' + fieldRows(s) +
      (s.notes ? '<h3 class="h-sub">Analyst notes</h3><p>' + esc(s.notes) + '</p>' : '') +
      matrixHTML(s) +
      ((s.operators || []).length
        ? '<h3 class="h-sub">Operators (' + s.operators.length + ')</h3><div class="pills">' +
          s.operators.map(function (o) {
            var label = o['Operator Country'] + (o['Military Service or Organization'] ? ' · ' + o['Military Service or Organization'] : '');
            return '<span class="pill">' + esc(label) + '</span>';
          }).join('') + '</div>'
        : '') +
      galleryHTML(s) + sourcesHTML(s) +
      '</div>';

    $('#drawer-body').innerHTML = html;
    $('#drawer').hidden = false;
    document.body.style.overflow = 'hidden';
    $('.drawer-close').focus();
  }

  function closeDrawer() {
    $('#drawer').hidden = true;
    document.body.style.overflow = '';
  }

  /* ---------- events ---------- */
  function wire() {
    $('#filters').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      var f = b.dataset.f, v = b.dataset.v;
      if (f === 'combat') FILTERS.combat = !FILTERS.combat;
      else FILTERS[f] = (FILTERS[f] === v) ? null : v;

      Array.prototype.forEach.call($('#filters').querySelectorAll('.chip'), function (c) {
        var on = c.dataset.f === 'combat'
          ? FILTERS.combat
          : FILTERS[c.dataset.f] === c.dataset.v;
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      renderGrid();
    });

    $('#q').addEventListener('input', function (e) { Q = e.target.value; renderGrid(); });

    $('#reset').addEventListener('click', function () {
      FILTERS = { domain: null, tier: null, origin: null, combat: false };
      Q = ''; $('#q').value = '';
      Array.prototype.forEach.call($('#filters').querySelectorAll('.chip'), function (c) {
        c.setAttribute('aria-pressed', 'false');
      });
      renderGrid();
    });

    $('#grid').addEventListener('click', function (e) {
      var c = e.target.closest('.card');
      if (c) openDrawer(c.dataset.id);
    });

    $('#drawer').addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeDrawer();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer();
    });
  }
})();
