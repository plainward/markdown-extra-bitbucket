/**
 * Adds "View source" and "Copy" buttons to a rendered block (Mermaid or
 * PlantUML diagram, KaTeX block). "View source" shows or hides the original
 * source below the block; "Copy" puts it on the clipboard.
 */
export function addSourceToggle(wrapper, source) {
  const actions = document.createElement('div');
  actions.className = 'markdownx-source-actions';

  const toggle = document.createElement('button');
  toggle.className = 'markdownx-source-toggle';
  toggle.textContent = 'View source';
  toggle.type = 'button';
  toggle.addEventListener('click', () => {
    const sourceEl = wrapper.querySelector(':scope > .markdownx-source');
    if (sourceEl) {
      sourceEl.remove();
      toggle.textContent = 'View source';
    } else {
      const pre = document.createElement('pre');
      pre.className = 'markdownx-source';
      const code = document.createElement('code');
      code.textContent = source;
      pre.appendChild(code);
      wrapper.appendChild(pre);
      toggle.textContent = 'Hide source';
    }
  });

  const copy = document.createElement('button');
  copy.className = 'markdownx-source-copy';
  copy.textContent = 'Copy';
  copy.type = 'button';
  let resetTimer = null;
  copy.addEventListener('click', async () => {
    const ok = await copyText(source);
    copy.textContent = ok ? 'Copied' : 'Copy failed';
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
  });

  actions.append(toggle, copy);
  wrapper.appendChild(actions);
}

async function copyText(text) {
  // navigator.clipboard exists only in secure contexts (HTTPS or localhost);
  // many Bitbucket DC instances run on plain HTTP inside the company network.
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // fall through to the legacy path
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  textarea.remove();
  return ok;
}
