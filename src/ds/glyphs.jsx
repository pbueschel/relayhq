import React from 'react';

/* ====================================================================== *
 * PRIORITY GLYPHS
 *
 * Two of the four priority marks do not exist in lucide, so they are drawn
 * here rather than substituted with a near-miss. The alternatives were a bomb
 * (a fuse and a sphere — unreadable at 11px, and it reads as "explosive
 * device" rather than "this is blowing up now") and an exclamation inside a
 * circle, which is a different mark from a bare exclamation and already means
 * "info" everywhere else in the app.
 *
 * They are authored to lucide's own contract so they sit beside Flame and
 * AlertTriangle without a seam: a 24×24 viewBox, no fill, `currentColor`
 * stroke at width 2, round caps and joins, and a `size` prop that drives both
 * width and height. Anything that can render a lucide icon can render these.
 * ====================================================================== */

const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

/** URGENT — a burst. Eight points, so it still reads as a blast at 11px. */
export function BurstGlyph({ size = 24, className, ...rest }) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path d="M12 2.5 L13.68 7.93 L18.72 5.28 L16.07 10.32 L21.5 12 L16.07 13.68 L18.72 18.72 L13.68 16.07 L12 21.5 L10.32 16.07 L5.28 18.72 L7.93 13.68 L2.5 12 L7.93 10.32 L5.28 5.28 L10.32 7.93 Z" />
    </svg>
  );
}

/** LOW — just an exclamation point. A stem and a dot, nothing around it. */
export function BangGlyph({ size = 24, className, ...rest }) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path d="M12 4v10" />
      <path d="M12 19h.01" />
    </svg>
  );
}
