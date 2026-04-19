/**
 * MarkdownX - Main orchestrator.
 * Sets up MutationObserver and dispatches to individual enhancers.
 *
 * Active features (each can be toggled off by a system admin via the
 * MarkdownX Admin page in Bitbucket's Manage apps section):
 *   - Mermaid diagrams
 *   - PlantUML diagrams (server-side)
 *   - LaTeX/Math (KaTeX)
 *
 * Debug logging: localStorage.setItem('markdownx-debug', '1') and reload.
 */

import { DomObserver } from './utils/dom-observer.js';
import { enhanceMermaid } from './mermaid-enhancer.js';
import { enhancePlantUml } from './plantuml-enhancer.js';
import { enhanceMath } from './katex-enhancer.js';

const _debug = typeof localStorage !== 'undefined' && localStorage.getItem('markdownx-debug') === '1';
const _t0 = performance.now();

function log(msg, ...args) {
  if (!_debug) return;
  console.log(`[MarkdownX +${(performance.now() - _t0).toFixed(1)}ms] ${msg}`, ...args);
}

console.log('[MarkdownX] Initializing v1.0.0' + (_debug ? ' (debug mode)' : ''));

function getContextPath() {
  return (typeof AJS !== 'undefined' && AJS.contextPath) ? AJS.contextPath() : '';
}

const DEFAULTS = {
  mermaidEnabled: true,
  plantumlEnabled: true,
  mathEnabled: true,
  mermaidTheme: 'default',
};

const SETTINGS_TIMEOUT_MS = 3000;

let settingsPromise = null;
function getSettings() {
  if (settingsPromise) return settingsPromise;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), SETTINGS_TIMEOUT_MS) : null;
  settingsPromise = fetch(getContextPath() + '/rest/markdownx/1.0/settings', {
    credentials: 'same-origin',
    signal: controller ? controller.signal : undefined,
  })
    .then((r) => (r.ok ? r.json() : DEFAULTS))
    .catch(() => DEFAULTS)
    .then((s) => ({ ...DEFAULTS, ...s }))
    .finally(() => { if (timer) clearTimeout(timer); });
  return settingsPromise;
}

const processQueue = [];
let processing = false;

async function processContainer(container) {
  const tag = container.tagName + (container.className ? '.' + container.className.split(' ')[0] : '');
  log(`processContainer called for <${tag}>, queue=${processQueue.length}, processing=${processing}`);

  processQueue.push(container);
  if (processing) return;
  processing = true;

  const settings = await getSettings();

  while (processQueue.length > 0) {
    const c = processQueue.shift();
    const cTag = c.tagName + (c.className ? '.' + c.className.split(' ')[0] : '');
    log(`processing <${cTag}>, dims=${c.offsetWidth}x${c.offsetHeight}`);
    try {
      if (settings.mermaidEnabled) await enhanceMermaid(c, settings);
      if (settings.plantumlEnabled) await enhancePlantUml(c);
      if (settings.mathEnabled) await enhanceMath(c);
    } catch (err) {
      console.error('[MarkdownX] Error processing container:', err);
    }
  }

  processing = false;
  log('processContainer done');
}

// Start observing when DOM is ready
function init() {
  const observer = new DomObserver((container) => {
    processContainer(container);
  });

  observer.start();

  log('Observer started');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
