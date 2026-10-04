// TS resolution anchor — bundlers load the .native/.web forks.
// MUST stay .tsx beside .tsx forks (a .ts anchor wins on native and ships the web build).
export { Select } from './Select.web';
export type { SelectProps, SelectOption } from './Select.types';
