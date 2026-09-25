/**
 * LaTeX/Math renderer using KaTeX.
 * Finds ```math code blocks and $inline$ math expressions,
 * renders them using KaTeX.
 */

let katexLoaded = false;
let katexLoading = null;
const processedBlocks = new WeakSet();

function getContextPath() {
  return (typeof AJS !== 'undefined' && AJS.contextPath) ? AJS.contextPath() : '';
}

async function loadKaTeX() {
  if (katexLoaded) return window.katex;
  if (katexLoading) return katexLoading;

  katexLoading = new Promise((resolve, reject) => {
    const ctx = getContextPath();
    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = ctx +
      '/download/resources/com.plainward.bitbucket.markdown-extra:katex-lib/katex.min.css';
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = ctx +
      '/download/resources/com.plainward.bitbucket.markdown-extra:katex-lib/katex.min.js';
    script.onload = () => {
      if (window.katex) {
        katexLoaded = true;
        resolve(window.katex);
      } else {
        reject(new Error('KaTeX not found on window'));
      }
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return katexLoading;
}

export async function enhanceMath(container) {
  // Process ```math code blocks
  const codeBlocks = container.querySelectorAll(
    'pre > code.language-math, pre > code[class*="language-math"], pre > code[data-language="math"]'
  );

  for (const codeEl of codeBlocks) {
    const preEl = codeEl.parentElement;
    if (processedBlocks.has(preEl)) continue;
    processedBlocks.add(preEl);

    const source = codeEl.textContent.trim();
    if (!source) continue;

    try {
      const katex = await loadKaTeX();
      const wrapper = document.createElement('div');
      wrapper.className = 'markdownx-math-block';
      katex.render(source, wrapper, {
        displayMode: true,
        throwOnError: false,
        // trust must stay off: \href{javascript:...}, \htmlData and
        // \includegraphics are XSS vectors for anyone who can push Markdown.
        trust: false,
      });
      preEl.replaceWith(wrapper);
    } catch (err) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'markdownx-math-error';
      errorDiv.textContent = 'Math rendering error: ' + err.message;
      preEl.after(errorDiv);
    }
  }

  // Process inline math: $...$ and $$...$$ (only in rendered text, not in code blocks)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip text inside code/pre/script/style elements and already-rendered math
      const parent = node.parentElement;
      if (parent && /^(code|pre|script|style|textarea)$/i.test(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent && parent.closest('.markdownx-math-inline, .markdownx-math-block, .katex')) {
        return NodeFilter.FILTER_REJECT;
      }
      // Must contain $...$
      if (/\$\$[^$]+\$\$/.test(node.textContent) || /\$[^$]+\$/.test(node.textContent)) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    },
  });

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  if (textNodes.length === 0) return;
  const katex = await loadKaTeX();

  for (const textNode of textNodes) {
    const text = textNode.textContent;
    const parts = text.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
    if (parts.length <= 1) continue;

    const frag = document.createDocumentFragment();
    for (const part of parts) {
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        // $$...$$ → display mode, $...$ → inline mode
        const isDisplay = part.startsWith('$$') && part.endsWith('$$') && part.length > 4;
        const mathSource = isDisplay ? part.slice(2, -2) : part.slice(1, -1);
        const el = document.createElement(isDisplay ? 'div' : 'span');
        el.className = isDisplay ? 'markdownx-math-block' : 'markdownx-math-inline';
        try {
          katex.render(mathSource, el, {
            displayMode: isDisplay,
            throwOnError: false,
          });
        } catch {
          el.textContent = part;
        }
        frag.appendChild(el);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    }
    textNode.replaceWith(frag);
  }
}
