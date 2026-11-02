/**
 * Skia's `.d.ts` declares `getNativeDevice(): bigint`, but at runtime it hands
 * the raw pointer as a string on iOS (its host fn returns the address). Pass
 * it through here before `importDevice` — the string threw "Value is a
 * string, expected a number" in the JSI host fn (A12X iPad). Kept RN-free so
 * it is testable in plain node.
 */
export function coerceSkiaPointer(pointer: bigint | string): bigint {
  if (typeof pointer !== 'string') return pointer;
  try {
    return BigInt(pointer);
  } catch {
    return BigInt(pointer.startsWith('0x') || pointer.startsWith('0X') ? pointer : `0x${pointer}`);
  }
}
