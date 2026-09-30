// Render tools/social-card.html to img/social-card.png (1200 × 630), the image
// shown when a page is shared on LinkedIn, X, Slack, iMessage and so on.
//
// Needs a local server at the repo root and Playwright (not a site dependency):
//   python3 -m http.server 8747 &
//   npm i --no-save playwright && npx playwright install chromium
//   node tools/build_social.js
//
// Optional: FONT_DIR=/path/to/woff2 renders with local copies of the site fonts
// (Fraunces, Archivo, IBM Plex Mono) when Google Fonts cannot be reached.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const base = process.env.BASE || 'http://localhost:8747';
  const out = path.join(__dirname, '..', 'img', 'social-card.png');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(base + '/tools/social-card.html');

  if (process.env.FONT_DIR) {
    const dir = process.env.FONT_DIR;
    const face = (family, weight, file) => {
      const data = fs.readFileSync(path.join(dir, file)).toString('base64');
      return `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;` +
        `src:url(data:font/woff2;base64,${data}) format("woff2");}`;
    };
    await page.addStyleTag({ content: [
      face('Fraunces', 700, 'fraunces-latin-700-normal.woff2'),
      face('Archivo', 400, 'archivo-latin-400-normal.woff2'),
      face('Archivo', 600, 'archivo-latin-600-normal.woff2'),
      face('Archivo', 700, 'archivo-latin-700-normal.woff2'),
      face('IBM Plex Mono', 500, 'ibm-plex-mono-latin-500-normal.woff2')
    ].join('') });
  }

  await page.waitForSelector('body[data-ready="1"]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out, type: 'png' });
  await browser.close();
  console.log('wrote', path.relative(process.cwd(), out));
})();
