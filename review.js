/* LAWS Tracker — review switcher.
   Shown only when the URL carries a review parameter (?systems=), so the public
   page is unaffected. Each row swaps one choice and keeps any others. */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  if (!q.has('systems')) return;

  /* The hero was settled in V3 (globe); only section 02 is still being compared. */
  var ROWS = [
    ['systems', 'Systems', [['current', 'Current'], ['map', 'Map'], ['grid', 'Grid']]]
  ];

  function href(key, value) {
    var n = new URLSearchParams(location.search);
    n.set(key, value);
    ROWS.forEach(function (r) { if (!n.has(r[0])) n.set(r[0], 'current'); });
    return '?' + n.toString() + location.hash;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.createElement('nav');
    nav.className = 'review-switch';
    nav.setAttribute('aria-label', 'Design options (review)');
    nav.innerHTML = ROWS.map(function (r) {
      var cur = (q.get(r[0]) || 'current').toLowerCase();
      if (!r[2].some(function (o) { return o[0] === cur; })) cur = 'current';
      return '<div class="rs-row"><span>' + r[1] + '</span>' + r[2].map(function (o) {
        return '<a href="' + href(r[0], o[0]) + '"' + (o[0] === cur ? ' aria-current="true"' : '') + '>' + o[1] + '</a>';
      }).join('') + '</div>';
    }).join('');
    document.body.appendChild(nav);
  });
})();
