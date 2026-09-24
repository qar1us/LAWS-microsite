/* LAWS Tracker — rendering and filtering.
   All content is driven from data.json, generated from the dataset workbook
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
          desc: 'A human selects the target; the system then tracks and completes the engagement unaided, including after signal or communication loss.',
          /* The closing sentence is completed from the data in renderTiers(), so the
             shares stay true when the dataset changes. */
          note: 'The B1 class was not anticipated by the project’s original criteria — a human selects the ' +
                'target, but the system completes the engagement unaided, including after signal or communication ' +
                'loss. It is the largest and fastest-growing class here.' }
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
  /* evidence is set at the data build from the label on Confirmed Effects:
     combat (corroborated), reported (uncorroborated), deployed, tested. */
  var hasCombat = function (s) { return s.evidence === 'combat'; };
  var EVIDENCE_LABEL = {
    combat: 'Combat use, corroborated', reported: 'Combat use reported, not corroborated',
    deployed: 'Deployed, no recorded engagement', tested: 'Tested or demonstrated'
  };
  var link = function (src) {
    return src && src.url
      ? '<a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.label || src.url) + '</a>'
      : esc(src && src.label != null ? src.label : src);
  };
  var icon = function (id, cls) {
    return '<svg class="ico ' + (cls || '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  };

  /* ---------- boot ---------- */
  fetch('data.json?v=202609241655')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (d) {
      DATA = d;
      SYSTEMS = d.systems;
      /* index.html and landscape.html share this file; each render step no-ops
         when its container is absent. */
      renderStats();
      if (window.LAWS_HERO) window.LAWS_HERO(d, { openDrawer: openDrawer });
      renderTiers();
      renderFilters();
      renderGrid();
      renderBars();
      renderMakers();
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
    /* The Aug 2026 criteria admit tested systems, so "fielded" is its own count. */
    countUp([
      ['s-systems', c.fielded != null ? c.fielded : c.systems],
      ['s-nohuman', noApproval],
      ['s-ops', c.operatorCountries]
    ]);
  }

  /* Hero figures count up from zero, staggered left to right. Screen readers get the
     final value from a hidden twin rather than the ticking digits, and reduced-motion
     users see the final value at once. */
  function countUp(items) {
    var els = items.map(function (it) { return [document.getElementById(it[0]), it[1]]; })
      .filter(function (it) { return it[0]; });
    if (!els.length) return;
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    els.forEach(function (it) {
      it[0].setAttribute('aria-hidden', 'true');
      var twin = document.createElement('span');
      twin.className = 'sr-only';
      twin.textContent = it[1];
      it[0].parentNode.insertBefore(twin, it[0]);
      it[0].textContent = still ? it[1] : 0;
    });
    if (still) return;
    var DUR = 1600, STAGGER = 140, t0 = null;
    var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
    function frame(now) {
      if (t0 === null) t0 = now;
      var done = true;
      els.forEach(function (it, i) {
        var t = Math.min(1, Math.max(0, (now - t0 - i * STAGGER) / DUR));
        it[0].textContent = Math.round(ease(t) * it[1]);
        if (t < 1) done = false;
      });
      if (!done) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- tier cards ---------- */
  function renderTiers() {
    var el = $('#tier-cards');
    if (!el) return;
    var counts = DATA.counts.byTier || {};
    var b1 = SYSTEMS.filter(function (s) { return s.tier === 'B1'; });
    var b1Combat = b1.filter(hasCombat).length, allCombat = SYSTEMS.filter(hasCombat).length;
    var b1Tail = ' Excluding it entirely would remove ' + b1.length + ' of the ' + SYSTEMS.length +
      ' systems here, and ' + b1Combat + ' of the ' + allCombat + ' with corroborated combat use.';
    el.innerHTML = TIER_ORDER.map(function (t) {
      var T = TIERS[t];
      /* The count bar that used to sit here was read as a progress meter rather than a
         share-of-dataset comparison, so it is gone; the number carries it. */
      var note = T.note
        ? '<span class="tip"><button class="tip-btn" type="button" aria-label="About the ' + t + ' class">' +
          icon('i-info') + '</button><span class="tip-pop" role="tooltip">' + T.note + (t === 'B1' ? b1Tail : '') + '</span></span>'
        : '';
      return '<div class="tier" style="--tc:' + T.color + '">' +
        '<span class="tier-n">' + (counts[t] || 0) + '</span>' +
        '<span class="tier-code">' + t + note + '</span>' +
        '<p class="tier-name">' + T.name + '</p>' +
        '<p class="tier-desc">' + T.desc + '</p>' +
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
    if (!$('#filters')) return;
    var dom = tally('domain'), org = tally('origin');
    var topOrigins = Object.keys(org).sort(function (a, b) { return org[b] - org[a]; }).slice(0, 8);

    /* Each group opens with a "View all" chip, pressed while that group is unfiltered. */
    var all = function (f) {
      return '<button class="chip chip-all" type="button" data-f="' + f + '" data-v="" aria-pressed="true">View all</button>';
    };
    var html = '';
    html += '<div class="fgroup"><span class="flabel">Domain</span>' + all('domain') +
      Object.keys(DOMAIN_ICON).filter(function (d) { return dom[d]; }).map(function (d) {
        return '<button class="chip" type="button" data-f="domain" data-v="' + esc(d) + '" aria-pressed="false">' +
          icon(DOMAIN_ICON[d]) + esc(d) + ' <span class="n">' + dom[d] + '</span></button>';
      }).join('') + '</div>';

    html += '<div class="fgroup"><span class="flabel">Autonomy</span>' + all('tier') +
      TIER_ORDER.map(function (t) {
        var n = (DATA.counts.byTier || {})[t] || 0;
        return '<button class="chip" type="button" data-f="tier" data-v="' + t + '" aria-pressed="false">' +
          t + ' <span class="n">' + n + '</span></button>';
      }).join('') + '</div>';

    html += '<div class="fgroup"><span class="flabel">Origin</span>' + all('origin') +
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
              s.domain, s.theater, s.targets, s.description, (s.purposes || []).join(' ')]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  function cardHTML(s) {
    var img = (s.images || [])[0];
    var tc = (TIERS[s.tier] || {}).color || 'var(--b1)';
    var style = '--tc:' + tc + ';--tint:' + tint(s.tier);
    var meta = [s.origin, s.manufacturer].filter(Boolean).map(esc).join(' <span class="sep">/</span> ');

    var flags = '';
    if (hasCombat(s)) flags += '<span class="flag on">' + icon('i-combat') + 'combat</span>';
    else if (s.evidence === 'reported') flags += '<span class="flag reported">' + icon('i-combat') + 'combat reported</span>';
    if (s.tier && s.tier !== 'B1') flags += '<span class="flag">' + icon('i-human') + 'no per-engagement approval</span>';

    /* The tier chip, domain glyph and title overlay the photo, so they live
       inside .card-img — it is their positioning context. */
    var overlay =
      '<span class="card-tier">' + esc(s.tier || '—') + '</span>' +
      '<span class="card-dom">' + icon(DOMAIN_ICON[s.domain] || 'i-multi') + '</span>' +
      '<span class="card-head"><span class="card-name">' + esc(s.name) + '</span>' +
      '<span class="card-id">' + esc(s.id) + '</span></span>';

    var media = img
      ? '<span class="card-img"><img src="img/' + esc(img.file) + '" alt="" loading="lazy" decoding="async">' + overlay + '</span>'
      : '<span class="card-img is-empty">' + icon(DOMAIN_ICON[s.domain] || 'i-multi') + overlay + '</span>';

    return '<button class="card" type="button" data-id="' + esc(s.id) + '" style="' + style + '">' +
      media +
      '<span class="card-body"><span class="card-meta">' + meta + '</span>' +
      '<span class="card-flags">' + flags + '</span></span>' +
      '</button>';
  }

  function renderGrid() {
    if (!$('#grid')) return;
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
  /* Ranked magnitude gets a single-hue ramp (light -> dark); identity gets the
     fixed categorical order. Every bar carries a visible count, which is also the
     relief the amber categorical step needs against a light surface. */
  function ramp(prefix, i, n) {
    var step = n <= 1 ? 5 : 5 - Math.round(i / (n - 1) * 4);
    return 'var(--' + prefix + '-' + step + ')';
  }

  function barBlock(el, entries, color) {
    if (!el) return;
    var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }));
    el.innerHTML = entries.map(function (e, i) {
      var c = typeof color === 'function' ? color(e[0], i, entries.length) : color;
      return '<div class="bar"><span class="bar-l">' + esc(e[0]) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + (e[1] / max * 100) + '%;--bc:' + c + '"></span></span>' +
        '<span class="bar-n">' + e[1] + '</span></div>';
    }).join('');
  }

  function sorted(map, limit) {
    var a = Object.keys(map).map(function (k) { return [k, map[k]]; })
      .sort(function (x, y) { return y[1] - x[1]; });
    return limit ? a.slice(0, limit) : a;
  }

  function operatorTally() {
    var opc = {};
    SYSTEMS.forEach(function (s) {
      var seen = {};
      (s.operators || []).forEach(function (o) {
        var c = o['Operator Country'];
        if (c && !seen[c]) { seen[c] = 1; opc[c] = (opc[c] || 0) + 1; }
      });
    });
    return opc;
  }

  function renderBars() {
    if (!$('#bars-origin')) return;

    barBlock($('#bars-origin'), sorted(tally('origin'), 12),
      function (k, i, n) { return ramp('seq', i, n); });

    barBlock($('#bars-operator'), sorted(operatorTally(), 12),
      function (k, i, n) { return ramp('tseq', i, n); });

    barBlock($('#bars-domain'), sorted(DATA.counts.byDomain),
      function (k, i) { return 'var(--cat-' + ((i % 5) + 1) + ')'; });

    var tb = DATA.counts.byTier;
    barBlock($('#bars-tier'),
      TIER_ORDER.filter(function (t) { return tb[t]; })
        .map(function (t) { return [t + ' — ' + TIERS[t].name.replace(/&amp;/g, '&'), tb[t]]; }),
      function (label) { return TIERS[label.slice(0, 2)].color; });
  }

  /* Abbreviated firm and agency names, written out in full (V2 review). Only exact
     cell fragments are mapped, so a name recorded some other way is left untouched. */
  var FIRM_NAMES = {
    'IAI': 'Israel Aerospace Industries (IAI)',
    'RTX': 'RTX Corporation',
    'CASIC': 'China Aerospace Science and Industry Corporation (CASIC)',
    'CSIC': 'China Shipbuilding Industry Corporation (CSIC)',
    'Norinco': 'China North Industries Group (NORINCO)',
    'GIWS': 'Gesellschaft für Intelligente Wirksysteme (GIWS)',
    'KBM': 'KBM Machine-Building Design Bureau',
    'KBP': 'KBP Instrument Design Bureau',
    'ATLA': 'Acquisition, Technology & Logistics Agency (ATLA)',
    'STM': 'STM Savunma Teknolojileri Mühendislik',
    'STM Savunma Teknolojileri': 'STM Savunma Teknolojileri Mühendislik',
    'ASELSAN': 'ASELSAN (Askeri Elektronik Sanayii)',
    'DARPA': 'Defense Advanced Research Projects Agency (DARPA)',
    'US Army RCCTO': 'US Army Rapid Capabilities and Critical Technologies Office (RCCTO)',
    'Israel MoD DDR&D': 'Israel MoD Directorate of Defense Research & Development (DDR&D)'
  };

  /* Split a free-text firm cell on the separators actually used ("/", ";", ","),
     but never inside brackets: "GIWS (Diehl, Rheinmetall)" is one entry. */
  function splitFirms(text) {
    var out = [], buf = '', depth = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if (depth === 0 && (ch === '/' || ch === ';' || ch === ',')) { out.push(buf); buf = ''; }
      else buf += ch;
    }
    out.push(buf);
    return out.map(function (p) { return p.trim(); }).filter(Boolean);
  }

  /* Manufacturers and developers, grouped by the country that produces them. */
  function renderMakers() {
    var el = $('#makers');
    if (!el) return;
    var byCountry = {};
    SYSTEMS.forEach(function (s) {
      if (!s.origin) return;
      var c = byCountry[s.origin] || (byCountry[s.origin] = { n: 0, firms: {} });
      c.n++;
      /* Manufacturer and developer are free text and record several firms per cell
         in mixed styles ("Rafael, IAI Elta", "RTX / Northrup Grumman"). Abbreviations
         are written out via FIRM_NAMES, but variants like "ZALA Aero" vs "ZALA Aero
         (Kalashnikov Concern)" are left as recorded — collapsing them would be an
         editorial decision, not a display one. */
      [s.manufacturer, s.developer].forEach(function (f) {
        if (!f) return;
        splitFirms(String(f)).forEach(function (part) {
          part = FIRM_NAMES[part] || part;
          c.firms[part] = (c.firms[part] || 0) + 1;
        });
      });
    });

    var rows = Object.keys(byCountry).sort(function (a, b) {
      return byCountry[b].n - byCountry[a].n || a.localeCompare(b);
    });

    el.innerHTML = rows.map(function (country, i) {
      var c = byCountry[country];
      var firms = sorted(c.firms);
      return '<div class="maker" style="--mc:' + ramp('seq', i, rows.length) + '">' +
        '<div class="maker-head"><span class="maker-country">' + esc(country) + '</span>' +
        '<span class="maker-n">' + c.n + ' system' + (c.n === 1 ? '' : 's') + '</span></div>' +
        '<ul class="maker-list">' + firms.map(function (f) {
          return '<li>' + esc(f[0]) + (f[1] > 1 ? '<span class="c">' + f[1] + '</span>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }).join('');
  }

  /* ---------- excluded annex ---------- */
  /* Methodology & limits are pulled from V.1 pending Rachel's further thoughts.
     This stays wired so the annex returns without rebuilding it. */
  function renderExcluded() {
    if (!$('#excl-grid')) return;
    var ex = DATA.excluded || [];
    $('#excl-count').textContent = '(' + ex.length + ')';
    $('#excl-grid').innerHTML = ex.map(function (e) {
      return '<div class="excl"><b>' + esc(e.name) + '</b>' +
        '<div class="cat">' + esc(e.country || '') + (e.category ? ' · ' + esc(e.category) : '') + '</div>' +
        '<p>' + esc(e.rationale || '') + '</p></div>';
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
      ['Targets', s.targets],
      ['Evidence of use', EVIDENCE_LABEL[s.evidence]]
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

  /* Evidence of use, pulled up out of the record table so it reads as a finding
     rather than another field. Corroborated combat gets the signal treatment;
     uncorroborated reports, deployments and tests are shown in a quieter register
     so they are never mistaken for confirmed use. */
  function evidenceHTML(s) {
    if (!s.effects) return '';
    var combat = s.evidence === 'combat' || s.evidence === 'reported';
    var bits = '';
    if (combat && s.theater) bits += '<dt>Theater</dt><dd>' + esc(s.theater) + '</dd>';
    if (combat && s.targets) bits += '<dt>Targets engaged</dt><dd>' + esc(s.targets) + '</dd>';
    var src = s.effectsSources || [];
    if (src.length) bits += '<dt>Sources</dt><dd class="evidence-src">' + src.map(link).join('<span class="sep"> · </span>') + '</dd>';
    return '<div class="evidence is-' + esc(s.evidence || 'other') + '">' +
      '<p class="evidence-h">' + icon('i-combat') + esc(EVIDENCE_LABEL[s.evidence] || 'Evidence of use') + '</p>' +
      '<p class="evidence-b">' + esc(s.effects) + '</p>' +
      (bits ? '<dl class="dl evidence-dl">' + bits + '</dl>' : '') +
      '</div>';
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
    return '<h3 class="h-sub">Sources</h3><div class="srclist">' + keys.map(function (k) {
      var v = src[k];
      /* Sources arrive as {label, url}; older builds stored a bare URL string. */
      if (typeof v === 'string' && /^https?:\/\//.test(v)) v = { label: v, url: v };
      return '<div><dt>' + esc(k) + '</dt>' + link(v) + '</div>';
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
      (s.description ? '<p class="d-desc">' + esc(s.description) + '</p>' : '') +
      (s.tierCaveat ? '<div class="note"><b>Analyst caveat:</b> ' + esc(s.tierCaveat) + '</div>' : '') +
      evidenceHTML(s) +
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
  function syncChips() {
    Array.prototype.forEach.call($('#filters').querySelectorAll('.chip'), function (c) {
      var f = c.dataset.f, v = c.dataset.v;
      var on = f === 'combat' ? FILTERS.combat
        : v === '' ? FILTERS[f] == null
        : FILTERS[f] === v;
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function wire() {
    if (!$('#filters')) return;   /* landscape.html has no tracker controls */
    $('#filters').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      var f = b.dataset.f, v = b.dataset.v;
      if (f === 'combat') FILTERS.combat = !FILTERS.combat;
      else if (v === '') FILTERS[f] = null;
      else FILTERS[f] = (FILTERS[f] === v) ? null : v;
      syncChips();
      renderGrid();
    });

    $('#q').addEventListener('input', function (e) { Q = e.target.value; renderGrid(); });

    $('#reset').addEventListener('click', function () {
      FILTERS = { domain: null, tier: null, origin: null, combat: false };
      Q = ''; $('#q').value = '';
      syncChips();
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
