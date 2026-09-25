/**
 * Mermaid diagram renderer.
 * Finds <pre><code class="language-mermaid"> blocks and renders them as SVG.
 *
 * Rendering happens inside a hidden <iframe> to isolate from page CSS.
 * Different Bitbucket pages load different CSS bundles that affect SVG text
 * measurements (getBBox), producing inconsistent diagram dimensions.
 *
 * Debug logging: localStorage.setItem('markdownx-debug', '1') and reload.
 */

const processedBlocks = new WeakSet();
const _debug = typeof localStorage !== 'undefined' && localStorage.getItem('markdownx-debug') === '1';
const t0 = performance.now();

function log(msg, ...args) {
  if (!_debug) return;
  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(`[Mermaid +${elapsed}ms] ${msg}`, ...args);
}

function getContextPath() {
  return (typeof AJS !== 'undefined' && AJS.contextPath) ? AJS.contextPath() : '';
}

// --- Iframe-isolated Mermaid renderer ---

let renderIframe = null;
let renderIframeReady = null;

function getOrCreateRenderIframe(theme) {
  if (renderIframe && renderIframe.parentElement && renderIframe.contentWindow?.mermaid) {
    return Promise.resolve(renderIframe);
  }
  if (renderIframeReady) return renderIframeReady;

  log('creating render iframe');
  renderIframeReady = new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1200px;height:800px;border:none;visibility:hidden';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument;

    // Base styles inside iframe — clean environment
    const style = iframeDoc.createElement('style');
    style.textContent =
      'body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:16px}';
    iframeDoc.head.appendChild(style);

    const script = iframeDoc.createElement('script');
    script.src = getContextPath() +
      '/download/resources/com.plainward.bitbucket.markdown-extra:mermaid-lib/mermaid.min.js';
    script.onload = () => {
      const iframeMermaid = iframe.contentWindow.mermaid;
      if (!iframeMermaid) {
        reject(new Error('mermaid not found in iframe'));
        return;
      }
      const config = {
        startOnLoad: false,
        theme: theme,
        // 'strict' disables click callbacks, javascript: links and raw HTML
        // labels. The SVG ends up in the host page's Shadow DOM, which does not
        // sandbox scripts, so anything looser is stored XSS for repo writers.
        securityLevel: 'strict',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        flowchart: { useMaxWidth: false },
        sequence: { useMaxWidth: false },
      };
      log('iframe mermaid.initialize:', JSON.stringify(config));
      iframeMermaid.initialize(config);
      renderIframe = iframe;
      renderIframeReady = null;
      resolve(iframe);
    };
    script.onerror = (e) => {
      renderIframeReady = null;
      reject(e);
    };
    iframeDoc.head.appendChild(script);
  });

  return renderIframeReady;
}

let renderCounter = 0;

export async function enhanceMermaid(container, settings) {
  const codeBlocks = container.querySelectorAll(
    'pre > code.language-mermaid, pre > code[class*="language-mermaid"], pre > code[data-language="mermaid"]'
  );

  if (codeBlocks.length === 0) return;

  const containerInfo = container.tagName + (container.className ? '.' + container.className.split(' ')[0] : '');
  log(`enhanceMermaid: found ${codeBlocks.length} block(s) in <${containerInfo}>`);
  log('enhanceMermaid: document.readyState =', document.readyState);
  log('enhanceMermaid: container dimensions =', container.offsetWidth, 'x', container.offsetHeight);

  // Wait for fonts to load — Mermaid uses getBBox() for text measurement
  if (document.fonts && document.fonts.ready) {
    log('enhanceMermaid: waiting for fonts...');
    await document.fonts.ready;
    log('enhanceMermaid: fonts ready');
  }

  const theme = (settings && settings.mermaidTheme) || 'default';
  const iframe = await getOrCreateRenderIframe(theme);
  const iframeMermaid = iframe.contentWindow.mermaid;
  const iframeDoc = iframe.contentDocument;

  log('enhanceMermaid: iframe ready, starting render loop');

  for (const codeEl of codeBlocks) {
    const preEl = codeEl.parentElement;
    if (processedBlocks.has(preEl)) continue;
    processedBlocks.add(preEl);

    const source = codeEl.textContent.trim();
    if (!source) continue;

    log('enhanceMermaid: rendering diagram, source length =', source.length);

    try {
      const id = `markdownx-mermaid-${++renderCounter}`;

      // Render inside the iframe — completely isolated from page CSS
      const renderContainer = iframeDoc.createElement('div');
      iframeDoc.body.appendChild(renderContainer);

      let svg;
      try {
        ({ svg } = await iframeMermaid.render(id, source, renderContainer));
      } finally {
        iframeDoc.body.removeChild(renderContainer);
      }

      log('render done, svg length =', svg.length);

      const wrapper = document.createElement('div');
      wrapper.className = 'markdownx-mermaid-diagram';

      // Use Shadow DOM to isolate SVG from page CSS
      // Bitbucket's CSS on filebrowser page overrides Mermaid's inline styles
      const svgHost = document.createElement('div');
      const shadow = svgHost.attachShadow({ mode: 'open' });

      // Wide chart types should fill the container width
      const isWideChart = /^\s*(gantt|pie|journey|gitGraph)/i.test(source);
      const svgStyle = isWideChart
        ? 'svg{width:100%;height:auto}'
        : 'svg{max-width:100%;height:auto}';
      shadow.innerHTML =
        `<style>:host{display:block;text-align:center}${svgStyle}</style>` + svg;
      wrapper.appendChild(svgHost);

      // Log SVG attributes for diagnostics
      if (_debug) {
        const svgEl = shadow.querySelector('svg');
        if (svgEl) {
          log('SVG attrs — width:', svgEl.getAttribute('width'),
              'height:', svgEl.getAttribute('height'),
              'viewBox:', svgEl.getAttribute('viewBox'));
        }
      }

      // Add a toggle to show/hide source
      const toggle = document.createElement('button');
      toggle.className = 'markdownx-source-toggle';
      toggle.textContent = 'View source';
      toggle.type = 'button';
      toggle.addEventListener('click', () => {
        const sourceEl = wrapper.querySelector('.markdownx-mermaid-source');
        if (sourceEl) {
          sourceEl.remove();
          toggle.textContent = 'View source';
        } else {
          const pre = document.createElement('pre');
          pre.className = 'markdownx-mermaid-source';
          const code = document.createElement('code');
          code.textContent = source;
          pre.appendChild(code);
          wrapper.appendChild(pre);
          toggle.textContent = 'Hide source';
        }
      });
      wrapper.appendChild(toggle);

      preEl.replaceWith(wrapper);
    } catch (err) {
      // Show error inline
      const errorDiv = document.createElement('div');
      errorDiv.className = 'markdownx-mermaid-error';
      errorDiv.innerHTML = `<strong>Mermaid syntax error:</strong><pre>${escapeHtml(err.message || String(err))}</pre>`;
      preEl.after(errorDiv);
    }
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
