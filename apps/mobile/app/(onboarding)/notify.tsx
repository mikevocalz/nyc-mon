import { useLocalSearchParams, useRouter } from 'expo-router';
import { NotifyGate } from '@acme/app/features/onboarding/NotifyScreen.tsx';

const MINUTES = [15, 30, 60] as const;

/**
 * M06 notifications permission sheet — presented as a `formSheet` (option set
 * in the (onboarding) layout). Standalone for now: M10 incubation choice does
 * not exist yet (handoff B4), so `eggId`/`endsAtMs`/`mins` arrive as search
 * params when a host presents it. `NotifyGate` skips the sheet unless the OS
 * permission is still undecided.
 */
export default function NotifyRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mins?: string; eggId?: string; endsAtMs?: string }>();

  const mins = MINUTES.find((m) => String(m) === params.mins) ?? 30;
  const endsAtMs = params.endsAtMs === undefined ? undefined : Number(params.endsAtMs);

  return (
    <NotifyGate
      minutes={mins}
      eggId={params.eggId}
      endsAtMs={Number.isFinite(endsAtMs) ? endsAtMs : undefined}
      onDone={() => router.back()}
    />
  );
}
