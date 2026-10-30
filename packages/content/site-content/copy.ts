import { safeLink } from './core.ts';
import type { SiteSection } from './reader.ts';

/** These are renderer/canon identities, not editorial text. They never change through copy fields. */
const structural = new Set(['id', 'key', 'type', 'kind', 'slot', 'tone', 'color', 'district', 'districtId', 'numeral', 'className', 'speciesId', 'bloodlineId']);
type Structural = 'id' | 'key' | 'type' | 'kind' | 'slot' | 'tone' | 'color' | 'district' | 'districtId' | 'numeral' | 'className' | 'speciesId' | 'bloodlineId';
export type Editable<T> = T extends (...args: never[]) => unknown ? T : T extends string ? string : T extends object ? { [K in keyof T]: K extends Structural ? T[K] : Editable<T[K]> } : T;

export function copyFields(value: unknown, prefix = ''): { key: string; label: string; value: string }[] {
  if (typeof value === 'string') return prefix ? [{ key: prefix, label: prefix.replaceAll('.', ' / '), value }] : [];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => structural.has(key) ? [] : copyFields(item, prefix ? `${prefix}.${key}` : key));
}

/** Overlay known string leaves only. Unknown keys, shapes, array lengths, functions and identities are immutable. */
export function copyFor<T>(section: SiteSection | undefined, defaults: T, prefix = ''): Editable<T> {
  const values = new Map(section?.copy.map((row) => [row.key, row.value]) ?? []);
  const visit = (value: unknown, path: string, key: string): unknown => {
    if (structural.has(key)) return value;
    if (typeof value === 'string') {
      const edited = values.get(path);
      if (edited === undefined) return value;
      // Link destinations are validated again at render time, including legacy imported data.
      if (/(href|url|link)$/i.test(key)) return safeLink(edited) ?? value;
      return edited;
    }
    if (Array.isArray(value)) return value.map((item, index) => visit(item, path ? `${path}.${index}` : String(index), String(index)));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, visit(item, path ? `${path}.${name}` : name, name)]));
    return value;
  };
  return visit(defaults, prefix, '') as Editable<T>;
}
