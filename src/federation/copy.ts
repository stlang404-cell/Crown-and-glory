/**
 * Deep copy of plain JSON-like data (objects, arrays, strings, numbers, booleans, null, undefined), the shape of
 * every federation record (competitors, round records, season plans, world state). It gives the same result as
 * `structuredClone` for such data — same keys in the same order, `undefined` members kept — and is several times
 * faster in V8 for many small records (docs/FEDERATION_SCALE.md §1.5). Not for Maps, Sets, Dates or typed arrays:
 * those are rejected so a misuse fails loudly instead of copying wrongly.
 */
export function copyData<T>(v: T): T {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    const n = v.length, out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = copyData(v[i]);
    return out as T;
  }
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) throw new TypeError('copyData: plain data only');
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v)) out[k] = copyData((v as Record<string, unknown>)[k]);
  return out as T;
}
