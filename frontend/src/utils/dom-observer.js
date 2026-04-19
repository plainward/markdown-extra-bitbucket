/**
 * MutationObserver wrapper for detecting markdown content changes.
 * Bitbucket DC uses React and dynamically renders content,
 * so we need to observe DOM mutations to catch new markdown containers.
 */

const MARKDOWN_SELECTORS = [
  '.markup-content',            // BB 8.x rendered markdown container
  '.markup-rendered',           // Alternative markdown container
  '.readme-content',            // README display
  '.filebrowser-readme',        // README on filebrowser (browse) page
  '.diff-content-inner',        // PR diff view
  '.file-content',              // File source view
  '.commit-message-rendered',   // Commit messages
  '[data-testid="RenderedContent"]', // Newer BB versions
];

export class DomObserver {
  constructor(callback, options = {}) {
    this._callback = callback;
    this._debounceMs = options.debounceMs || 150;
    this._observer = null;
    this._timer = null;
    this._processedNodes = new WeakSet();
    this._t0 = performance.now();
    this._scanCount = 0;
    this._debug = typeof localStorage !== 'undefined' && localStorage.getItem('markdownx-debug') === '1';
  }

  _log(msg, ...args) {
    if (!this._debug) return;
    const elapsed = (performance.now() - this._t0).toFixed(1);
    console.log(`[DomObserver +${elapsed}ms] ${msg}`, ...args);
  }

  start() {
    this._log('start() called, readyState:', document.readyState);
    // Process any existing content immediately
    this._scanExisting();

    // Observe future mutations
    this._observer = new MutationObserver((mutations) => {
      let hasRelevant = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            hasRelevant = true;
            break;
          }
        }
        if (hasRelevant) break;
      }
      if (hasRelevant) {
        this._debouncedScan();
      }
    });

    this._observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  stop() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  _debouncedScan() {
    if (this._timer) clearTimeout(this._timer);
    this._log('mutation detected, debouncing scan...');
    this._timer = setTimeout(() => this._scanExisting(), this._debounceMs);
  }

  _scanExisting() {
    this._scanCount++;
    const selector = MARKDOWN_SELECTORS.join(', ');
    const containers = document.querySelectorAll(selector);
    this._log(`scan #${this._scanCount}: found ${containers.length} containers`);
    for (const container of containers) {
      const tag = container.tagName + '.' + (container.className || '').split(' ')[0];
      const isNew = !this._processedNodes.has(container);
      if (isNew) {
        this._log(`  NEW container: <${tag}>, dims=${container.offsetWidth}x${container.offsetHeight}, children=${container.childElementCount}`);
        this._processedNodes.add(container);
        this._callback(container);
      }
      // Also check for dynamically added content inside already-processed containers
      this._callback(container);
    }
    // Also scan the entire document for code blocks that might be outside known containers
    this._callback(document.body);
  }
}
