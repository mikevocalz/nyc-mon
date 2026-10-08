// Contract §9: banned campaign words anywhere in the rendered page, and the
// generic word "device" anywhere inside the H-Lynk section (text and
// accessible-name attributes). Reads server HTML with JavaScript disabled.
import fs from 'node:fs';
import path from 'node:path';
import { BASE, CONFIG, ROOT, launch, table } from './lib.mjs';

const BANNED = [
  ['unlock', /\bunlock(?:s|ed|ing)?\b/gi],
  ['reimagine', /\breimagin(?:e|es|ed|ing)\b/gi],
  ['seamless', /\bseamless(?:ly)?\b/gi],
  ['next-generation', /\bnext[\s-]+gen(?:eration)?\b/gi],
  ['AI-powered', /\bAI[\s-]+powered\b/gi],
  ['immersive experience', /\bimmersive\s+experiences?\b/gi],
  ['meet your new best friend', /\bmeet\s+your\s+new\s+best\s+friend\b/gi],
  ['the future is here', /\bthe\s+future\s+is\s+here\b/gi],
  ['elevate', /\belevat(?:e|es|ed|ing)\b/gi],
  ['supercharge', /\bsupercharg(?:e|es|ed|ing)\b/gi],
  ['journey', /\bjourneys?\b/gi],
];
const DEVICE = ['device', /\bdevices?\b/gi];
const ATTRS = ['aria-label', 'alt', 'title', 'placeholder', 'aria-description'];

const allow = JSON.parse(fs.readFileSync(path.join(ROOT, 'copy-allowlist.json'), 'utf8')).entries ?? [];
const allowed = (hit) => allow.some((a) =>
  a.term.toLowerCase() === hit.term.toLowerCase()
  && (!a.route || a.route === hit.route)
  && (!a.scope || a.scope === hit.scope)
  && hit.snippet.toLowerCase().includes(a.context.toLowerCase()));

function scan(route, scope, chunks, rules) {
  const hits = [];
  for (const { where, text } of chunks) {
    const clean = text.replace(/\s+/g, ' ');
    for (const [term, re] of rules) {
      for (const m of clean.matchAll(re)) {
        const snippet = clean.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).trim();
        hits.push({ route, scope, term, where, match: m[0], snippet });
      }
    }
  }
  return hits;
}

const { browser } = await launch('bundled');
const ctx = await browser.newContext({ javaScriptEnabled: false });
const page = await ctx.newPage();
const hits = [];
let hlynkFound = false;

for (const route of CONFIG.copyLintRoutes) {
  const res = await page.goto(BASE + route, { waitUntil: 'load' });
  if (!res || res.status() >= 400) {
    console.error(`copy-lint: ${route} returned ${res?.status()}`);
    process.exit(2);
  }
  const data = await page.evaluate(({ attrs, hlynk }) => {
    // Join text nodes with a space: textContent glues adjacent blocks
    // ("The device" + "The H-Lynk Core" -> "deviceThe"), which defeats \b.
    const textOf = (root) => {
      const parts = [];
      // No filter callback: page JS is disabled, so callbacks cannot run.
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.parentElement?.closest('script, style, noscript, template')) parts.push(n.nodeValue);
      }
      return parts.join(' ');
    };
    const attrsOf = (root) => [root, ...root.querySelectorAll('*')].flatMap((el) =>
      attrs.filter((a) => el.hasAttribute?.(a)).map((a) => ({ where: `@${a} <${el.tagName.toLowerCase()}>`, text: el.getAttribute(a) })));
    const meta = [...document.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')]
      .map((m) => ({ where: `meta ${m.getAttribute('name') ?? m.getAttribute('property')}`, text: m.getAttribute('content') ?? '' }));
    let h = null;
    for (const sel of hlynk) { h = document.querySelector(sel); if (h) break; }
    return {
      page: [{ where: 'title', text: document.title }, ...meta, { where: 'body text', text: textOf(document.body) }, ...attrsOf(document.body)],
      hlynk: h ? [{ where: 'text', text: textOf(h) }, ...attrsOf(h)] : null,
    };
  }, { attrs: ATTRS, hlynk: CONFIG.hlynkSelectors });
  hits.push(...scan(route, 'page', data.page, BANNED));
  if (data.hlynk) {
    hlynkFound = true;
    hits.push(...scan(route, 'hlynk', data.hlynk, [DEVICE]));
  }
}
await browser.close();

if (!hlynkFound) {
  console.error(`copy-lint: no H-Lynk section matched ${CONFIG.hlynkSelectors.join(', ')} on ${CONFIG.copyLintRoutes.join(', ')}`);
  process.exit(2);
}
const failing = hits.filter((h) => !allowed(h));
const waived = hits.length - failing.length;
console.log(`copy-lint ${BASE} routes=${CONFIG.copyLintRoutes.join(',')} hits=${hits.length} allowlisted=${waived}`);
if (failing.length) {
  console.log(table(failing, ['route', 'scope', 'term', 'where', 'snippet']));
  process.exit(1);
}
console.log('copy-lint: clean');
