/**
 * Adds a "View source" button to a rendered block (PlantUML diagram, KaTeX block)
 * that shows or hides the original source below it.
 */
export function addSourceToggle(wrapper, source) {
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
  wrapper.appendChild(toggle);
}
