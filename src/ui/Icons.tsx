/**
 * Crown icon family: original line icons drawn on a 24×24 grid with a 1.75 px round-capped stroke.
 * Straight strokes sit on whole/half pixel coordinates so they stay crisp at 16, 20, 24 and 32 px; media
 * controls (first/prev/next/last) use stroked solid triangles so they read at small button sizes.
 * Decorative by default (aria-hidden); pass `title` for a standalone, labelled icon (role="img").
 */
import type { SVGProps } from 'react';

/** One drawing: stroked paths, plus optional solid shapes (filled and stroked to round their corners). */
interface Glyph { s?: string[]; f?: string[]; c?: [number, number, number][] }

const G = {
  // navigation
  play: { s: ['M7.5 5.6v12.8a.9.9 0 0 0 1.37.77l10.4-6.4a.9.9 0 0 0 0-1.54L8.87 4.83A.9.9 0 0 0 7.5 5.6z'] },
  world: { s: ['M3.5 9h17M3.5 15h17', 'M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9c2.4-2.5 3.6-5.5 3.6-9S14.4 5.5 12 3z'], c: [[12, 12, 9]] },
  exchange: { s: ['M3.5 17.5l5.25-5.25 3.5 3.5 7.75-7.75', 'M15 8h5v5', 'M3.5 20.5h17'] },
  finance: {
    s: [
      'M4.5 7c0-1.38 3.36-2.5 7.5-2.5s7.5 1.12 7.5 2.5-3.36 2.5-7.5 2.5S4.5 8.38 4.5 7z',
      'M4.5 7v5c0 1.38 3.36 2.5 7.5 2.5s7.5-1.12 7.5-2.5V7',
      'M4.5 12v5c0 1.38 3.36 2.5 7.5 2.5s7.5-1.12 7.5-2.5v-5',
    ],
  },
  library: { s: ['M4.5 5h3.5v15H4.5z', 'M10 8h3.5v12H10z', 'M15 19.2 18.1 7.6l3 .8L18 20z', 'M4.5 8.5h3.5M10 11h3.5'] },
  academy: { s: ['M2.5 9.5 12 5l9.5 4.5L12 14z', 'M6.5 11.6V16c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.4', 'M21.5 9.5V15'] },
  profile: { s: ['M4.5 20.5c.6-3.8 3.6-6 7.5-6s6.9 2.2 7.5 6'], c: [[12, 8.5, 4]] },
  rivals: {
    s: [
      'M4.5 4.5 14 14', 'M11.5 16.5l5-5', 'M14 14l3.5 3.5',
      'M19.5 4.5 10 14', 'M12.5 16.5l-5-5', 'M10 14l-3.5 3.5',
    ],
    c: [[18.75, 18.75, 1.25], [5.25, 18.75, 1.25]],
  },
  hall: {
    s: [
      'M7.5 4.5h9v5a4.5 4.5 0 0 1-9 0z',
      'M7.5 6.5H5a.5.5 0 0 0-.5.5v.5a3.5 3.5 0 0 0 3.2 3.5',
      'M16.5 6.5H19a.5.5 0 0 1 .5.5v.5a3.5 3.5 0 0 1-3.2 3.5',
      'M12 14v3', 'M9 20.5h6', 'M9.5 20.5l.6-3.5h3.8l.6 3.5',
    ],
  },
  analysis: { s: ['M4 19.5h16', 'M4 4.5v15', 'M6.5 15.5l4-5 3 2.5 5-7'] },
  lab: { s: ['M9 3.5h6', 'M10.25 3.5v5.4L5.1 18.2a1.6 1.6 0 0 0 1.4 2.3h11a1.6 1.6 0 0 0 1.4-2.3l-5.15-9.3V3.5', 'M7.6 14.5h8.8'] },
  settings: { s: ['M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1'], c: [[15, 7, 2], [9, 12, 2], [17, 17, 2]] },
  // board and game controls
  flip: { s: ['M7 4l-3 3 3 3', 'M4 7h11.5a4.5 4.5 0 0 1 4.5 4.5', 'M17 20l3-3-3-3', 'M20 17H8.5A4.5 4.5 0 0 1 4 12.5'] },
  flag: { s: ['M5.5 21V3.5', 'M5.5 4.5h12.25L15 9l2.75 4.5H5.5'] },
  handshake: {
    s: [
      'M2.5 12.5 6 7.5h3.5L12 6.5l2.5 1h3.5l3.5 5',
      'M12 6.5 8.9 9.6a1.4 1.4 0 0 0 2 2l2.1-2.1 4.6 4.6',
      'M6.5 14l4.5 4.3a1.5 1.5 0 0 0 2.1 0l4.5-4.3',
      'M9.5 16.6l1.4-1.4M11.7 18.3l1.1-1.1',
    ],
  },
  first: { s: ['M6.5 6v12'], f: ['M17.5 7v10l-7.5-5z'] },
  prev: { f: ['M15.25 7v10l-7.5-5z'] },
  next: { f: ['M8.75 7v10l7.5-5z'] },
  last: { s: ['M17.5 6v12'], f: ['M6.5 7v10l7.5-5z'] },
  pause: { f: ['M7.5 6.5h3v11h-3z', 'M13.5 6.5h3v11h-3z'] },
} satisfies Record<string, Glyph>;

export type IconName = keyof typeof G;
export const ICON_NAMES = Object.keys(G) as IconName[];

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName | string;
  /** Accessible name; omit for decorative icons next to visible text or inside a labelled button. */
  title?: string;
  /** Rendered width/height (CSS sizes in .btn, .nav-btn and .tabbar take precedence). */
  size?: number | string;
};

export function Icon({ name, title, size = '1.25em', className, ...rest }: IconProps) {
  const g: Glyph | undefined = (G as Record<string, Glyph>)[name];
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true as const, focusable: 'false' as const };
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className ? `icon ${className}` : 'icon'}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-icon={name}
      {...a11y}
      {...rest}
    >
      {title && <title>{title}</title>}
      {g?.s?.map((d, i) => <path key={`s${i}`} d={d} />)}
      {g?.c?.map(([cx, cy, r], i) => <circle key={`c${i}`} cx={cx} cy={cy} r={r} />)}
      {g?.f?.map((d, i) => <path key={`f${i}`} d={d} fill="currentColor" />)}
      {!g && <path d="M12 7.5 16.5 12 12 16.5 7.5 12z" />}
    </svg>
  );
}
