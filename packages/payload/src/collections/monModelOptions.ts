// Option lists shared by the mon-models collection and the console's Models
// page. Plain values only, so the browser bundle never pulls in the collection.

/** What each animation clip is for. Grounded in the care actions (feed, rest, wake, play), idle vignettes (awake, asleep), hatching and evolution. */
export const MON_ANIMATION_ROLES = ['idle', 'asleep', 'feed', 'rest', 'wake', 'play', 'hatch', 'evolve'] as const;
export const MON_MODEL_LICENSES = ['owned', 'cc0', 'cc-by-4.0', 'other'] as const;
