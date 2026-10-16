'use client';
// The NYC Rank panel (Master Directive v2 §3 "Rive leaderboard"; G02
// 08-handoff.md § Components, § States). The housing is the kit's night-faced
// board in both schemes (`SolidPanel tone="ink"`): header band 40 pt, a body
// that reserves four 56 pt rows in every state so START never jumps between
// opens. Rows and rank motion are the `leaderboard` artboard inside the body,
// bound through `leaderboard/status` and `leaderboard/rows[n]/*`; without
// the artboard (web, Storybook, an asset that failed to load) the kit draws
// the rows as text. Status copy (`g02.rank.*`) is always the kit's, so the
// spoken region label and the visible sentence come from one source.
//
// Accessibility (review finding H2): the root is a plain container, never an
// `accessible` element, so the rows and "Try again" stay reachable. The
// header band carries the region label; every row is its own element. With
// the artboard drawing the rows, its authored semantics are turned off (they
// speak the score, which 05-copy.md forbids) and transparent row frames carry
// the kit's row labels at the same 56 pt pitch.
//
// The client never computes a rank or names a unit: `score` renders only
// when the model carries one and is never spoken (05-copy.md).
import { useEffect } from 'react';
import type { District } from '../district/districts';
import { testIdProps } from '../hlynk/a11y';
import { LoadingSkeleton } from '../LoadingSkeleton';
import { SolidPanel } from '../neon/SolidPanel';
import { SignageBand } from '../SignageBand';
import { StatusRow } from '../StatusRow';
import { Text } from '../Text';
import { View } from '../tw';
import type { ArcadeRiveSource } from '../game-controls/ArcadeRiveSurface.types.ts';
import { LOBBY_COPY, rowAccessibleLabel, staleAccessibleLabel, staleHeadline } from './lobby-copy.ts';
import type { LeaderboardModel, LeaderboardRow } from './lobby-contract.ts';
import { keylineFor, leaderboardAccessibility, panelRowsOf, ROW_DIVIDER, SELF_ROW_MARKER } from './leaderboard-style.ts';
import { LobbyRiveSurface } from './LobbyRiveSurface';
import { useLobbyRiveBinding } from './use-lobby-rive-binding.ts';

/** Props of {@linkcode LeaderboardPanel}. */
export interface LeaderboardPanelProps {
  readonly model: LeaderboardModel;
  readonly reducedMotion: boolean;
  /** The last verified district: a 2 dp keyline in its tone on the header band (03-direction.md). */
  readonly district?: District;
  /** "Try again" on `error`. Absent: the status line has no action. */
  readonly onRetry?: () => void;
  /** The `leaderboard` artboard. Absent: rows render as kit text. */
  readonly rive?: ArcadeRiveSource;
  /** Clock for the stale age: when the lobby was opened, from the app's store, never read during render. */
  readonly nowMs: number;
  /** Stops the artboard's render loop while the lobby is covered or backgrounded (review finding M15). @default false */
  readonly paused?: boolean;
  readonly testID?: string;
}

/** Header band height. */
export const PANEL_HEADER_PT = 40;
/** One rank row. */
export const PANEL_ROW_PT = 56;
/** Rows the body reserves in every state: three ranked plus the Caller's own. */
export const PANEL_ROWS_RESERVED = 4;

/**
 * The lobby's ranking board. The header band names the region and speaks
 * status changes politely; each row and the retry action are their own
 * elements (07-a11y.md § Focus order).
 *
 * @see {@linkcode LeaderboardPanelProps}
 */
export function LeaderboardPanel({ model, reducedMotion, district, onRetry, rive, nowMs, paused = false, testID }: LeaderboardPanelProps) {
  const rows = panelRowsOf(model);
  const now = nowMs;

  const binding = useLobbyRiveBinding((b) => {
    b.setLeaderboardStatus(model.status);
    b.setLeaderboardRows(rows);
    b.setReducedMotion(reducedMotion);
  });
  useEffect(() => {
    binding.write((b) => {
      b.setLeaderboardStatus(model.status);
      b.setLeaderboardRows(rows);
    });
  }, [binding, model.status, rows]);
  useEffect(() => { binding.write((b) => b.setReducedMotion(reducedMotion)); }, [binding, reducedMotion]);

  const a11y = leaderboardAccessibility(model, rows);
  const dimmed = model.status === 'stale';
  const keyline = keylineFor(district);
  const riveRows = Boolean(rive?.file);

  const body = (() => {
    switch (model.status) {
      case 'loading':
        return (
          <View className="gap-4 px-4 py-3" {...(testIdProps(testID ? `${testID}-loading` : undefined) as object)}>
            <LoadingSkeleton variant="line" count={3} />
            <Text variant="caption" className="text-silver-500" accessibilityLiveRegion="polite">
              {LOBBY_COPY.rankLoading}
            </Text>
          </View>
        );
      case 'unavailable':
        return (
          <View className="gap-1 px-4 py-3">
            <Text variant="body" className="text-ink-50">{LOBBY_COPY.rankUnavailable}</Text>
            <Text variant="caption" className="text-silver-300">{LOBBY_COPY.rankUnavailableBody}</Text>
          </View>
        );
      case 'empty':
        return (
          <View className="gap-1 px-4 py-3">
            <Text variant="body" className="text-ink-50">{LOBBY_COPY.rankEmpty}</Text>
            {model.selfEligible ? <Text variant="caption" className="text-silver-300">{LOBBY_COPY.rankEmptySelf}</Text> : null}
          </View>
        );
      case 'error':
        return (
          <View className="px-4 py-3" {...(testIdProps(testID ? `${testID}-status` : undefined) as object)}>
            <StatusRow
              items={[
                {
                  id: 'rank-status',
                  label: LOBBY_COPY.rankError,
                  tone: 'neutral',
                  action: onRetry ? { label: LOBBY_COPY.rankErrorAction, onPress: onRetry } : undefined,
                },
              ]}
            />
          </View>
        );
      case 'ready':
      case 'stale':
        return (
          <>
            {model.status === 'stale' ? (
              <View {...(testIdProps(testID ? `${testID}-stale` : undefined) as object)} accessibilityLabel={staleAccessibleLabel(model.updatedAtMs, now)}>
                <SignageBand tone="signage" size="strip" headline={staleHeadline(model.updatedAtMs, now)} />
              </View>
            ) : null}
            {riveRows
              ? rows.map((row, index) => (
                  // The artboard draws this row; the frame only carries its spoken label.
                  <View
                    key={row.playerId}
                    accessible
                    accessibilityLabel={a11y.rowLabels[index]}
                    {...(testIdProps(testID ? `${testID}-row-${row.rank}` : undefined) as object)}
                    style={{ height: PANEL_ROW_PT }}
                  />
                ))
              : rows.map((row) => <Row key={row.playerId} row={row} dimmed={dimmed} testID={testID} />)}
          </>
        );
    }
  })();

  return (
    <View {...(testIdProps(testID) as object)} testID={testID} className="w-full">
      <SolidPanel tone="ink" depth="sm" className="w-full">
        <View
          className={`flex-row items-center border-b-2 px-4 ${keyline}`}
          // Computed: the header band is 40 pt (08-handoff.md § Layout).
          style={{ height: PANEL_HEADER_PT }}
          accessible
          accessibilityRole="header"
          accessibilityLabel={a11y.regionLabel}
          accessibilityLiveRegion="polite"
          {...(testIdProps(testID ? `${testID}-region` : undefined) as object)}
        >
          <Text variant="label" className="text-ink-50 tracking-wide">{LOBBY_COPY.rankTitle}</Text>
        </View>
        <View
          className="relative w-full"
          // Computed: four 56 pt rows reserved in every state so the panel never collapses.
          style={{ minHeight: PANEL_ROW_PT * PANEL_ROWS_RESERVED }}
        >
          <LobbyRiveSurface
            riveFile={rive?.file}
            artboardName={rive?.artboardName}
            stateMachineName={rive?.stateMachineName}
            onBinding={binding.onBinding}
            exposeSemantics={false}
            paused={paused}
            style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
          />
          {body}
        </View>
      </SolidPanel>
    </View>
  );
}

function Row({ row, dimmed, testID }: { row: LeaderboardRow; dimmed: boolean; testID?: string }) {
  const text = dimmed ? 'text-silver-500' : 'text-silver-300';
  const numeral = row.rank <= 3 ? 'text-ink-50' : text;
  return (
    <View
      {...(testIdProps(testID ? `${testID}-row-${row.rank}` : undefined) as object)}
      accessible
      accessibilityLabel={rowAccessibleLabel(row.rank, row.name, row.isSelf)}
      className={`flex-row items-center gap-3 border-b ${ROW_DIVIDER} px-4 ${row.isSelf ? `border-l-[3px] ${SELF_ROW_MARKER}` : ''}`}
      // Computed: every row is 56 pt (08-handoff.md § Layout).
      style={{ height: PANEL_ROW_PT }}
    >
      {row.rank === 1 ? <View aria-hidden className="h-6 w-[3px] bg-orange-500" /> : null}
      <Text variant={row.rank <= 3 ? 'label' : 'caption'} className={`w-8 ${numeral}`} style={{ fontVariant: ['tabular-nums'] }}>
        {String(row.rank)}
      </Text>
      <Text variant="body" className={`flex-1 ${text}`} numberOfLines={1}>{row.name}</Text>
      {row.isSelf ? <Text variant="caption" className="text-carolina-500">{LOBBY_COPY.rankSelf}</Text> : null}
      {row.score === undefined ? null : (
        <Text variant="body" className={`font-semibold ${text}`} style={{ fontVariant: ['tabular-nums'] }}>
          {String(row.score)}
        </Text>
      )}
    </View>
  );
}
