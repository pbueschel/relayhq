import { useSyncExternalStore, useRef, useCallback } from 'react';

/**
 * RelayHQ store.
 *
 * WHY NOT useState AT THE ROOT: v1 held every collection in useState on one
 * component, so every view re-rendered on every keystroke and every inner
 * component remounted. This store lets a view subscribe to just the slice it
 * reads, so editing a ticket does not re-render the asset table.
 *
 * WHY NOT A LIBRARY: the whole thing is ~80 lines and adding a dependency to a
 * prototype that must build on GitHub Pages buys nothing.
 *
 * Shape: one flat object of collections. Every mutation goes through
 * `update(fn)`, which produces a new root object so subscribers can compare by
 * reference.
 */

let state = {};
const listeners = new Set();

export function initStore(initial) {
  state = initial;
  emit();
}

export function getState() {
  return state;
}

function emit() {
  for (const l of Array.from(listeners)) l();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Apply a producer to the state.
 * @param {(s: object) => object|void} fn  return a new state, or mutate a shallow copy
 */
export function update(fn) {
  const next = fn(state);
  if (next && next !== state) {
    state = next;
    persist();
    emit();
  }
}

/** Replace one collection. The common case. */
export function setCollection(key, valueOrFn) {
  update(s => {
    const prev = s[key];
    const next = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn;
    if (next === prev) return s;
    return { ...s, [key]: next };
  });
}

/* ------------------------------------------------------------------ *
 * React binding
 * ------------------------------------------------------------------ */

const identity = (s) => s;

/**
 * Subscribe to a slice. The selector result is cached and compared shallowly
 * so returning a fresh object/array literal each call does not cause an
 * infinite render loop — a real hazard with useSyncExternalStore.
 */
export function useStore(selector = identity) {
  const selRef = useRef(selector);
  selRef.current = selector;
  const cache = useRef({ src: undefined, out: undefined, has: false });

  const getSnapshot = useCallback(() => {
    const src = state;
    const c = cache.current;
    if (c.has && c.src === src) return c.out;
    const out = selRef.current(src);
    // Reuse the previous result when shallow-equal so consumers see a stable ref.
    if (c.has && shallowEqual(c.out, out)) {
      c.src = src;
      return c.out;
    }
    c.src = src; c.out = out; c.has = true;
    return out;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * Persistence
 *
 * v1 could not use browser storage because of its render target. RelayHQ ships
 * to GitHub Pages, where localStorage is available, so demo edits survive a
 * reload. The seed is never mutated in place; it is the fallback when storage
 * is empty or a schema version bumps.
 * ------------------------------------------------------------------ */

const STORAGE_KEY = 'relayhq.demo.v1';
const SCHEMA_VERSION = 1;

let persistTimer = null;
let persistEnabled = true;

function persist() {
  if (!persistEnabled) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, state }));
    } catch {
      // Quota exceeded (data-URL media in the seed can be large) or storage
      // disabled. The app keeps working in memory; only durability is lost.
      persistEnabled = false;
    }
  }, 250);
}

export function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== SCHEMA_VERSION) return null;
    return parsed.state;
  } catch {
    return null;
  }
}

/** Wipe local edits and fall back to the seed on next load. */
export function resetDemo() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  location.reload();
}

/* ------------------------------------------------------------------ *
 * Collection helpers — the CRUD verbs every module uses, so no module
 * hand-rolls array surgery and they all behave identically.
 * ------------------------------------------------------------------ */

export function addTo(key, record) {
  setCollection(key, (list = []) => [...list, record]);
  return record;
}

export function patchIn(key, id, patch) {
  setCollection(key, (list = []) =>
    list.map(r => r.id === id ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r));
}

export function removeFrom(key, id) {
  setCollection(key, (list = []) => list.filter(r => r.id !== id));
}

export function findIn(key, id) {
  return (state[key] || []).find(r => r.id === id) || null;
}

/* ------------------------------------------------------------------ *
 * Ids and clock
 *
 * Ids are prefixed so a raw id in a log line tells you what it points at.
 * ------------------------------------------------------------------ */

let counter = 0;
export function uid(prefix = 'id') {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** The demo clock. Fixed so seeded relative dates stay meaningful. */
export const NOW = new Date('2026-08-16T09:00:00');

export function nowISO() {
  return new Date().toISOString();
}
