import { hash128 } from './random.ts';

// D-15g: the first look at the hatch leans in or hesitates, 2:1. A Caller
// under 13 always gets lean-in. A hesitation is presentation only: it never
// reads as refusal and changes no state.

/** How the Baby first looks at the Caller in M12's `attention` phase. */
export type FirstLook = 'lean-in' | 'hesitate';

/**
 * The first look for an individual. Pure and stable: the same
 * `monInstanceId` always gives the same answer on every device, so a resumed
 * or replayed hatch shows the same look. Over many individuals two in three
 * lean in. `callerIsUnder13` forces lean-in.
 *
 * TODO(canon): Decision #14 ("the Mon chooses") has no fixed source for the
 * weights; 2:1 is the lead's interim call (D-15g).
 */
export function deriveFirstLook(monInstanceId: string, callerIsUnder13: boolean): FirstLook {
  if (callerIsUnder13) return 'lean-in';
  const [word] = hash128(`nyc-mon/first-look/${monInstanceId}`);
  return word % 3 === 2 ? 'hesitate' : 'lean-in';
}
