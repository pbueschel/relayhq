import { useSyncExternalStore, useCallback } from 'react';

/**
 * Hash router.
 *
 * GitHub Pages has no server-side rewrite, so a path router would 404 on any
 * deep link or refresh. Hash routing costs nothing here and makes every screen
 * linkable — which matters because this prototype gets demoed by sending
 * someone a URL.
 *
 * Route shape: #/section/sub?k=v
 */

function read() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const params = {};
  if (queryPart) {
    for (const [k, v] of new URLSearchParams(queryPart)) params[k] = v;
  }
  return {
    section: segments[0] || 'workspace',
    sub: segments[1] || null,
    id: segments[2] || null,
    segments,
    params,
    href: raw,
  };
}

let current = read();
const listeners = new Set();

function onHash() {
  current = read();
  for (const l of Array.from(listeners)) l();
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', onHash);
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return current;
}

export function useRoute() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function buildHref(section, sub, id, params) {
  let out = '#/' + [section, sub, id].filter(Boolean).map(encodeURIComponent).join('/');
  if (params && Object.keys(params).length) {
    out += '?' + new URLSearchParams(params).toString();
  }
  return out;
}

export function navigate(section, sub, id, params) {
  const next = buildHref(section, sub, id, params);
  if (window.location.hash !== next) window.location.hash = next;
  else onHash();
}

export function useNavigate() {
  return useCallback((section, sub, id, params) => navigate(section, sub, id, params), []);
}
