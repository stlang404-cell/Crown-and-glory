const P: Record<string, string> = {
  play: 'M7 4.5v15l12-7.5z',
  library: 'M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.8-1 2.6 15.5-3.8 1z',
  profile: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5z',
  lab: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3',
  world: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9m0-18C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9M3.5 9h17M3.5 15h17',
  academy: 'M3 9l9-5 9 5-9 5zM7 11.5V16c0 1.5 2.5 3 5 3s5-1.5 5-3v-4.5M21 9v6',
  exchange: 'M4 17l5-6 4 3 7-9M15 5h5v5',
  finance: 'M4 20h16M6 16v-5M10 16V8M14 16v-7M18 16V5',
  settings: 'M4 6h9m4 0h3M15 3.5v5M4 12h3m4 0h9M9 9.5v5M4 18h11m4 0h1M17 15.5v5',
  rivals: 'M4 20L10 8L14 14M20 20L14 8L10 14M8 4H16',
  hall: 'M7 4H17V9C17 12 15 14 12 14C9 14 7 12 7 9ZM12 14V18M8 20H16M7 6H4V8C4 10 5 11 7 11M17 6H20V8C20 10 19 11 17 11',
  flip: 'M7 7h11l-3-3M17 17H6l3 3',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  handshake: 'M3 12l4-4 5 3 5-3 4 4-9 8z',
  first: 'M5 5h2.6v14H5zM19 5l-10 7 10 7z',
  prev: 'M16 5l-9 7 9 7z',
  next: 'M8 5l9 7-9 7z',
  last: 'M16.4 5H19v14h-2.6zM5 5l10 7-10 7z',
};
export function Icon({ name }: { name: keyof typeof P | string }) {
  const filled = ['play', 'first', 'prev', 'next', 'last', 'profile'].includes(name);
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name] ?? ''} />
    </svg>
  );
}
