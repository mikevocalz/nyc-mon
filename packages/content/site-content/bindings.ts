import { safeLink, record } from './core.ts';
import { sectionFor, sectionText, type SitePage, type SiteSection } from './reader.ts';

/** Copy may change words, never executable code, identifiers, or object shape. */
const structural = new Set(['id', 'key', 'slug', 'slot', 'color', 'tone', 'className', 'speciesId', 'bloodlineId']);
const linkKey = (key: string) => /(?:href|url|link)$/i.test(key);
export function copyTree<T>(defaults: T, section?: SiteSection, prefix = ''): T {
  const visit = (value: unknown, key: string): unknown => {
    const field = key || 'value';
    if (typeof value === 'string') {
      const edited = sectionText(section, field, value);
      return linkKey(field) ? safeLink(edited) ?? value : edited;
    }
    if (typeof value === 'function') {
      const edited = section?.copy.find(row => row.key === field)?.value;
      if (edited === undefined) return value;
      return (...args: unknown[]) => {
        const result = edited.replace(/\{(\d+)\}/g, (_, index: string) => String(args[Number(index)] ?? ''));
        return linkKey(field) ? safeLink(result) ?? value(...args) : result;
      };
    }
    if (Array.isArray(value)) return value.map((item, i) => visit(item, key ? `${key}.${i}` : String(i)));
    if (record(value)) return Object.fromEntries(Object.entries(value).map(([name, child]) => [name,
      structural.has(name) ? child : visit(child, key ? `${key}.${name}` : name)]));
    return value;
  };
  return visit(defaults, prefix) as T;
}
export const sectionKey = (value: string) => value.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
export function copyGroups<T extends object>(defaults: T, page?: SitePage | null, map: Record<string, string> = {}): T {
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key,
    copyTree(value, sectionFor(page, map[key] ?? sectionKey(key)))])) as T;
}
export function copyRows(value: unknown, prefix = ''): { key: string; label: string; value: string }[] {
  const rows: { key: string; label: string; value: string }[] = [];
  const walk = (item: unknown, key: string) => {
    if (typeof item === 'function') {
      try { const text = item('{0}', '{1}', '{2}'); if (typeof text === 'string') walk(text, key); } catch { /* Explicit seed handles non-string formatters. */ }
    } else if (typeof item === 'string') {
      const field = key || 'value'; rows.push({ key: field, label: field.replaceAll('.', ' / '), value: item });
    } else if (Array.isArray(item)) item.forEach((child, index) => walk(child, key ? `${key}.${index}` : String(index)));
    else if (record(item)) for (const [name, child] of Object.entries(item)) if (!structural.has(name)) walk(child, key ? `${key}.${name}` : name);
  };
  walk(value, prefix); return rows;
}
