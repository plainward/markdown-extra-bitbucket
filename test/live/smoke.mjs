// Live smoke test against a running Bitbucket seeded by setup.sh.
// Usage: BB_URL=http://localhost:7990 node smoke.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BB = process.env.BB_URL || 'http://localhost:7990';
const OUT = process.env.OUT_DIR || 'live-results';
mkdirSync(OUT, { recursive: true });

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`FAIL  ${name}\n      ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const basic = (u, p) => ({ Authorization: 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64') });
const ADMIN = basic('admin', 'admin');
const ALICE = basic('alice', 'alice');

async function http(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(BB + path, {
    method,
    redirect: 'manual',
    headers: { 'X-Atlassian-Token': 'no-check', ...headers },
    body,
  });
  return { status: res.status, location: res.headers.get('location') || '', text: await res.text() };
}
const json = (h) => ({ ...h, 'Content-Type': 'application/json', Accept: 'application/json' });

// ---------- HTTP / permission checks ----------

await check('admin servlet: anonymous is redirected to login', async () => {
  const r = await http('/plugins/servlet/markdownx/admin');
  assert(r.status === 302 || r.status === 303, `expected redirect, got ${r.status}`);
  assert(/login/i.test(r.location), `redirect target is not login: ${r.location}`);
});

await check('admin servlet: non-admin gets 403', async () => {
  const r = await http('/plugins/servlet/markdownx/admin', { headers: ALICE });
  assert(r.status === 403, `expected 403, got ${r.status}`);
});

await check('admin servlet: sysadmin gets the page', async () => {
  const r = await http('/plugins/servlet/markdownx/admin', { headers: ADMIN });
  assert(r.status === 200, `expected 200, got ${r.status}`);
  assert(r.text.includes('MarkdownX Settings'), 'page body missing');
});

await check('settings REST: non-admin cannot save', async () => {
  const r = await http('/rest/markdownx/1.0/settings', {
    method: 'PUT', headers: json(ALICE), body: JSON.stringify({ mermaidTheme: 'dark' }),
  });
  assert(r.status === 403, `expected 403, got ${r.status}`);
});

await check('settings REST: admin can save and read back', async () => {
  const put = await http('/rest/markdownx/1.0/settings', {
    method: 'PUT', headers: json(ADMIN), body: JSON.stringify({ mermaidTheme: 'forest' }),
  });
  assert(put.status === 200, `PUT expected 200, got ${put.status}: ${put.text}`);
  const get = await http('/rest/markdownx/1.0/settings', { headers: json(ALICE) });
  assert(get.status === 200, `GET expected 200, got ${get.status}`);
  assert(JSON.parse(get.text).mermaidTheme === 'forest', `theme not saved: ${get.text}`);
  await http('/rest/markdownx/1.0/settings', {
    method: 'PUT', headers: json(ADMIN), body: JSON.stringify({ mermaidTheme: 'default' }),
  });
});

await check('PlantUML REST: anonymous is rejected', async () => {
  const r = await http('/rest/markdownx/1.0/plantuml/render', {
    method: 'POST', headers: json({}), body: JSON.stringify({ source: 'A -> B' }),
  });
  assert(r.status === 401 || r.status === 403, `expected 401/403, got ${r.status}`);
});

await check('PlantUML REST: renders SVG, rejects empty and oversized input', async () => {
  const ok = await http('/rest/markdownx/1.0/plantuml/render', {
    method: 'POST', headers: json(ALICE), body: JSON.stringify({ source: 'Alice -> Bob : hi' }),
  });
  assert(ok.status === 200 && JSON.parse(ok.text).svg.includes('<svg'), `render failed: ${ok.status} ${ok.text.slice(0, 300)}`);
  const empty = await http('/rest/markdownx/1.0/plantuml/render', {
    method: 'POST', headers: json(ALICE), body: JSON.stringify({ source: '' }),
  });
  assert(empty.status === 400, `empty: expected 400, got ${empty.status}`);
  const big = await http('/rest/markdownx/1.0/plantuml/render', {
    method: 'POST', headers: json(ALICE), body: JSON.stringify({ source: 'A -> B\n'.repeat(10_000) }),
  });
  assert(big.status === 400, `oversized: expected 400, got ${big.status}`);
});

await check('PlantUML REST: sandbox blocks local file include', async () => {
  const r = await http('/rest/markdownx/1.0/plantuml/render', {
    method: 'POST', headers: json(ALICE), body: JSON.stringify({ source: '!include /etc/passwd\nA -> B' }),
  });
  assert(!r.text.includes('root:'), 'contents of /etc/passwd leaked into the response');
});

// ---------- Browser checks ----------

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const page = await context.newPage();
const dialogs = [];
const consoleErrors = [];
page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await check('login as admin', async () => {
  await page.goto(BB + '/login');
  await page.fill('input[name="j_username"]', 'admin');
  await page.fill('input[name="j_password"]', 'admin');
  await Promise.all([page.waitForNavigation({ timeout: 60_000 }), page.press('input[name="j_password"]', 'Enter')]);
  assert(!page.url().includes('/login'), `still on login page: ${page.url()}`);
});

// Collects rendering state across the document and any shadow roots.
async function renderState() {
  return page.evaluate(() => {
    const all = (root, sel) => {
      let out = [...root.querySelectorAll(sel)];
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot) out = out.concat(all(el.shadowRoot, sel));
      return out;
    };
    const scope = [...document.querySelectorAll('[class^="markdownx-"], [class*=" markdownx-"]')];
    const jsLinks = scope.flatMap((el) => all(el, '[href], [*|href]'))
      .map((a) => a.getAttribute('href') || a.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '')
      .filter((h) => /^\s*javascript:/i.test(h));
    const handlers = scope.flatMap((el) => all(el, '*'))
      .filter((el) => [...el.attributes].some((a) => /^on/i.test(a.name))).length;
    return {
      // Mermaid SVG lives in a shadow root under the wrapper
      mermaid: [...document.querySelectorAll('.markdownx-mermaid-diagram')]
        .filter((w) => [...w.children].some((c) => c.shadowRoot && c.shadowRoot.querySelector('svg'))).length,
      plantuml: document.querySelectorAll('.markdownx-plantuml-diagram svg').length,
      mathBlock: document.querySelectorAll('.markdownx-math-block .katex').length,
      mathInline: document.querySelectorAll('.markdownx-math-inline .katex').length,
      errors: [...document.querySelectorAll('.markdownx-mermaid-error, .markdownx-plantuml-error, .markdownx-math-error')].map((e) => e.textContent),
      jsLinks,
      handlers,
    };
  });
}

async function checkRenderedPage(label, path) {
  await check(`${label}: diagrams and math render`, async () => {
    await page.goto(BB + path);
    let s;
    for (let i = 0; i < 60; i++) {
      s = await renderState();
      if (s.mermaid && s.plantuml && s.mathBlock && s.mathInline) break;
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: true });
    assert(s.errors.length === 0, `render errors: ${JSON.stringify(s.errors)}`);
    assert(s.mermaid > 0, 'no Mermaid SVG');
    assert(s.plantuml > 0, 'no PlantUML SVG');
    assert(s.mathBlock > 0, 'no KaTeX block');
    assert(s.mathInline > 0, 'no KaTeX inline');
  });

  await check(`${label}: XSS payloads are neutralised`, async () => {
    const s = await renderState();
    assert(s.jsLinks.length === 0, `javascript: links present: ${JSON.stringify(s.jsLinks)}`);
    assert(s.handlers === 0, `${s.handlers} inline event handler attribute(s) in rendered output`);
    // Click everything clickable in the rendered output; nothing may fire.
    const targets = await page.$$('.markdownx-plantuml-diagram a, .markdownx-math-block a, .markdownx-mermaid-diagram');
    for (const t of targets) await t.click({ force: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(1000);
    assert(dialogs.length === 0, `dialog fired: ${JSON.stringify(dialogs)}`);
  });
}

await checkRenderedPage('file-view', '/projects/TEST/repos/test-markdown/browse/README.md');
await checkRenderedPage('repo-browse', '/projects/TEST/repos/test-markdown/browse');

await check('admin menu shows translated label (i18n registered)', async () => {
  await page.goto(BB + '/admin');
  const body = await page.content();
  await page.screenshot({ path: `${OUT}/admin-menu.png`, fullPage: true });
  assert(!body.includes('markdownx.admin.label'), 'raw i18n key rendered');
  assert(body.includes('Markdown Extra Settings'), 'admin link label not found');
});

await check('admin page UI: toggle and save', async () => {
  await page.goto(BB + '/plugins/servlet/markdownx/admin');
  await page.waitForSelector('#content', { state: 'visible', timeout: 30_000 });
  await page.selectOption('#mermaidTheme', 'neutral');
  await page.click('#save-btn');
  await page.waitForSelector('#status.success', { timeout: 15_000 });
  await page.screenshot({ path: `${OUT}/admin-page.png`, fullPage: true });
  await page.selectOption('#mermaidTheme', 'default');
  await page.click('#save-btn');
});

await check('no MarkdownX errors in browser console', async () => {
  const ours = consoleErrors.filter((e) => /markdownx|mermaid|katex|plantuml/i.test(e));
  assert(ours.length === 0, JSON.stringify(ours).slice(0, 2000));
});

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
