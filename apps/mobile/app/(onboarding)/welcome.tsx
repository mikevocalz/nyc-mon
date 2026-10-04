import { Redirect } from 'expo-router';

/**
 * M02 welcome carousel is flagged off (B4: panel-2 egg captures are
 * `TODO(canon)`; placeholder art cannot ship). The route exists so the M01
 * first-run mapping stays spec-shaped; until the flag flips it forwards to
 * the same destination `bootPath` picks.
 */
export default function WelcomeRoute() {
  return <Redirect href="/(auth)/age" />;
}
