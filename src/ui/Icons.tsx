const P: Record<string, string> = {
  play: 'M7 4.5v15l12-7.5z',
  library: 'M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.8-1 2.6 15.5-3.8 1z',
  profile: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5z',
  lab: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3',
  world: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9m0-18C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9M3.5 9h17M3.5 15h17',
  flip: 'M7 7h11l-3-3M17 17H6l3 3',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  handshake: 'M3 12l4-4 5 3 5-3 4 4-9 8z',
  first: 'M6 5v14M18 5l-9 7 9 7z',
  prev: 'M16 5l-9 7 9 7z',
  next: 'M8 5l9 7-9 7z',
  last: 'M18 5v14M6 5l9 7-9 7z',
};
export function Icon({ name }: { name: keyof typeof P | string }) {
  const filled = ['play', 'first', 'prev', 'next', 'last', 'profile'].includes(name);
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name] ?? ''} />
    </svg>
  );
}
