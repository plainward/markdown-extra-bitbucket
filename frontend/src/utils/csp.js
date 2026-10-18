/**
 * Bitbucket 10 sends a Content-Security-Policy whose script-src only allows
 * /s/ static URLs or a per-page nonce. Our lazily loaded libraries come from
 * /download/resources/, so scripts we inject must carry the page's nonce.
 * Browsers hide the nonce attribute value but keep it on the .nonce property.
 * Returns '' on versions without a nonce (8.x/9.x), where it is not needed.
 */
export function cspNonce() {
  const holder = document.querySelector('script[nonce]');
  return (holder && (holder.nonce || holder.getAttribute('nonce'))) || '';
}

/** Creates a <script> in `doc` that satisfies the page's CSP. */
export function createScript(doc, src) {
  const script = doc.createElement('script');
  const nonce = cspNonce();
  if (nonce) script.nonce = nonce;
  script.src = src;
  return script;
}
