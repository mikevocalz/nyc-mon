/** Exhaustiveness guard for discriminated-union switches (§0A.2). */
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
