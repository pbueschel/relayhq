import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ThemeProvider } from '@/ds';
import { initStore, loadPersisted } from '@/store/store.js';
import { buildSeed } from '@/store/seed/index.js';
import './index.css';

/* Local edits win over the seed; the seed is the fallback and is never mutated. */
const persisted = loadPersisted();
initStore(persisted || buildSeed());

// Signal to the headless render check that the app mounted and painted.
function ready() {
  document.documentElement.setAttribute('data-relayhq-ready', '1');
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

requestAnimationFrame(() => requestAnimationFrame(ready));
