/**
 * Tells this process's `/v1/mon-lingo` reader that Payload's lingo changed.
 * The `language-lexicon` collection and the `mon-voices` global call it after
 * every write, so an edit in the admin is served on the next request here;
 * other instances pick it up when their short TTL runs out.
 */
let generation = 0;

export function invalidateMonLingo(): void {
  generation += 1;
}

export function monLingoGeneration(): number {
  return generation;
}
