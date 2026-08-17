# Playbook — extending RelayHQ without breaking the look

Read this before adding a screen. The live counterpart is `#/design`, which renders the real
components; this file is the prose that does not fit on a page.

## The one-minute version

```jsx
import {
  useTheme, cx, ICON, DENSITY,
  PageHeader, PageBody, Section, Card, Panel, ListRow,
  Button, IconButton, Chip, ChipGroup, StatusPill, Avatar, EmptyState,
  Field, Input, Select, Modal,
} from '@/ds';
import { useStore, setCollection, uid } from '@/store/store.js';
import { Inbox } from 'lucide-react';

export default function MyView() {
  const { t, a } = useTheme();      // t = surfaces, a(hue) = accent class set
  const items = useStore(s => s.tickets);
  const c = a('rose');              // never `bg-${hue}-500`

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader icon={Inbox} accent="rose" title="Tickets" subtitle="…" />
      <PageBody>
        <div className={DENSITY.rowGap}>
          {items.map(x => <ListRow key={x.id} accent="ticket" title={x.title} />)}
        </div>
      </PageBody>
    </div>
  );
}
```

## Where colour comes from

Three layers, and you should almost always be at the top one.

1. **Entity kind** — `<ListRow accent="ticket">`, `<IconTile accent="change">`. The registry in
   `tokens.js` maps kind → hue. Use this whenever the thing on screen *is* an entity.
2. **Raw hue** — `const c = a('amber')`. For UI that is not an entity: a warning banner, a
   highlight. `c` then gives you `soft`, `softStrong`, `softHover`, `fg`, `fgOnSoft`, `border`,
   `borderStrong`, `solid`, `solidHover`, `dot`, `rail`, `ring`.
3. **Surfaces** — `t.bg`, `t.bgCard`, `t.bgInput`, `t.text`, `t.textSecondary`, `t.textMuted`,
   `t.border`, `t.borderLight`, `t.modal`, `t.overlay`. Everything neutral comes from here.

**Never** interpolate. `` `bg-${hue}-500` `` compiles to nothing — Tailwind resolves classes by
scanning source text and cannot see a runtime string. `test/smoke.js` fails the build if you do.

If you need a neutral surface `t` does not have, that is a token gap: add it to both `LIGHT` and
`DARK` in `tokens.js`. Do not inline a grey — the smoke gate rejects it, and rightly, because a
hardcoded grey is invisible in one of the two themes.

## Choosing a hue for a new entity

Add it to `ENTITIES` in `tokens.js`. Pick a hue no sibling entity already uses in the same view.
If two entities share a hue, that must *mean* something — `lesson` and `article` share blue because
a lesson is a knowledge atom, and `project` and `projectTask` share violet because a project task
belongs to a project. Sharing by accident is a bug.

## Density

Start from the constants; do not pick a padding.

- Rows in a list: `DENSITY.rowGap` between, `DENSITY.rowPad` inside.
- Cards and panels: `DENSITY.cardPad`.
- Icons: `ICON.base` (14) inline, `ICON.md`/`ICON.lg` in headers, `ICON.tile` (24) in a large tile,
  `ICON.empty` (40) in an empty state.

The direction of travel is always tighter. v1 went `p-6`→`p-4`, `p-5`→`p-3.5`, icons 18–20→14,
`space-y-3`→`space-y-2`, `line-clamp-2`→`line-clamp-1`. These constants are the end state of that,
so a new surface should start dense rather than needing the same pass again.

## Chips show values, not counts

`<ChipGroup items={people} render={p => p.name} max={2} />` renders the real names and an overflow
badge whose tooltip lists the rest. Never render "3 CC'd". This came up repeatedly in v1 and applies
broadly — queues, labels, members, affected services, everything.

## Condensing inside a nested pane

Use **container queries**, not `md:`/`lg:`. Viewport breakpoints respond to the window and fire at
the wrong moment when the element sits inside a sub-pane that is narrower than the window.

The reference implementation is the lens bar, in `index.css`:

```css
.lens-shell { container-type: inline-size; }
.lens-track, .lens-group { gap: clamp(2px, 1.3cqw, 8px); }
.lens-pill { padding-left: clamp(8px, 2cqw, 18px); padding-right: clamp(8px, 2cqw, 18px); }
```

Tighten continuously first; wrap only as a last resort.

## Modals

Always `<Modal>`. It gives you the pinned header, `flex-1 overflow-auto` body, pinned footer, and a
`border-2` in the entity accent so a glance at the frame tells you what you are editing. It renders
through a portal on `document.body`, so nested modals are never clipped by a parent's overflow —
v1's `z-[110]` workaround is no longer needed.

Destructive cascades use `<ConfirmDelete>`, which requires typing the record's exact name.

## Components live at module scope

Never declare a component inside another component's body:

```jsx
// WRONG — remounts on every parent render, losing focus and local state
export default function View() {
  const Row = ({ x }) => <div>{x.name}</div>;
  …
}
```

This was v1's single biggest structural cost: every inner component was redefined per render, so
React unmounted and remounted it. Editors that held local state depended on that behaviour, which
made the pattern load-bearing and hard to unwind. Do not reintroduce it.

Local editor state is fine — just put the component at module scope and pass what it needs.

## Reading and writing state

```jsx
const tickets = useStore(s => s.tickets);          // subscribes to that slice only
const open = useStore(s => s.tickets.filter(t => t.status === 'open'));  // also fine —
                                                    // results are shallow-compared
addTo('tickets', { id: uid('tkt'), … });
patchIn('tickets', id, { status: 'resolved' });
removeFrom('tickets', id);
```

Selectors returning fresh arrays are safe: the store shallow-compares and reuses the previous
result, so you will not spin. Cross-domain seed ids come from `@/store/seed/ids.js`.

## Before you call it done

```
bun test/smoke.js
bun run build
bun test/render-check.js    # alone — a second headless Chrome will hang it
```

The smoke gate is not a formality; it encodes the rules above as executable guards. If it fails,
the fix is almost always to use the design system rather than to relax the guard.
