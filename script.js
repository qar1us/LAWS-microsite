// Progressive enhancement only — the page must remain fully readable without JS.
(function () {
  'use strict';

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
