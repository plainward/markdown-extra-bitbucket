/**
 * PlantUML diagram renderer.
 * Finds ```plantuml code blocks, sends source to server-side REST API,
 * and replaces with rendered SVG.
 */

import DOMPurify from 'dompurify';

function getContextPath() {
  return (typeof AJS !== 'undefined' && AJS.contextPath) ? AJS.contextPath() : '';
}
const processedBlocks = new WeakSet();

export async function enhancePlantUml(container) {
  const codeBlocks = container.querySelectorAll(
    'pre > code.language-plantuml, pre > code[class*="language-plantuml"], pre > code[data-language="plantuml"]'
  );

  if (codeBlocks.length === 0) return;

  for (const codeEl of codeBlocks) {
    const preEl = codeEl.parentElement;
    if (processedBlocks.has(preEl)) continue;
    processedBlocks.add(preEl);

    const source = codeEl.textContent.trim();
    if (!source) continue;

    // Show loading indicator
    const loading = document.createElement('div');
    loading.className = 'markdownx-loading';
    loading.textContent = 'Rendering PlantUML...';
    preEl.after(loading);

    try {
      const response = await fetch(getContextPath() + '/rest/markdownx/1.0/plantuml/render', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ source }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const result = await response.json();

      const wrapper = document.createElement('div');
      wrapper.className = 'markdownx-plantuml-diagram';
      wrapper.innerHTML = sanitizeSvg(result.svg);

      loading.remove();
      preEl.replaceWith(wrapper);
    } catch (err) {
      loading.remove();
      const errorDiv = document.createElement('div');
      errorDiv.className = 'markdownx-plantuml-error';
      errorDiv.innerHTML = `<strong>PlantUML error:</strong> ${escapeHtml(err.message)}`;
      preEl.after(errorDiv);
    }
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function sanitizeSvg(svgString) {
  // PlantUML output embeds user-controlled text and [[links]], so treat it as
  // untrusted: DOMPurify drops scripts, event handlers and javascript: URLs.
  return DOMPurify.sanitize(svgString || '', {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
