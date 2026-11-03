/**
 * Resolve the RN axis shorthands used by portable controls before handing a
 * concrete style object to the kit's real web button/input. Container and text
 * primitives already go through react-native-web and need no conversion here.
 */
export function studioDomStyle(input: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { paddingHorizontal, paddingVertical, marginHorizontal, marginVertical,
    textAlignVertical, ...rest } = input;
  const style: Record<string, unknown> = { ...rest };
  if (paddingHorizontal !== undefined) { style.paddingLeft ??= paddingHorizontal; style.paddingRight ??= paddingHorizontal; }
  if (paddingVertical !== undefined) { style.paddingTop ??= paddingVertical; style.paddingBottom ??= paddingVertical; }
  if (marginHorizontal !== undefined) { style.marginLeft ??= marginHorizontal; style.marginRight ??= marginHorizontal; }
  if (marginVertical !== undefined) { style.marginTop ??= marginVertical; style.marginBottom ??= marginVertical; }
  if (Object.keys(style).some(key => /border.*Width$/.test(key)) && style.borderStyle === undefined) style.borderStyle = 'solid';
  // RN's vertical text alignment is a native text-field concept, not a CSS
  // property. Web textareas already start at the top of their content box.
  void textAlignVertical;
  return style;
}

/** Inline RN direction must also beat a kit utility emitted with !important. */
export function studioDirectionClass(direction: unknown): string | undefined {
  switch (direction) {
    case 'row': return 'flex-row';
    case 'row-reverse': return 'flex-row-reverse';
    case 'column': return 'flex-col';
    case 'column-reverse': return 'flex-col-reverse';
    default: return undefined;
  }
}
