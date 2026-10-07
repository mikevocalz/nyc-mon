/** Every home section, in page order. `site-qa` keys screenshots and axe scans on these. */
export type HomeSectionId = 'hero' | 'signage' | 'world' | 'hlynk' | 'starters' | 'care' | 'hatch' | 'footer';

/**
 * `data-section="<id>"` on a section root. react-native-web turns `dataSet`
 * into `data-*` attributes (createDOMProps), but the React Native view types
 * don't declare it, hence the cast at this one boundary.
 */
export function sectionMarker(id: HomeSectionId): object {
  return { dataSet: { section: id } };
}
