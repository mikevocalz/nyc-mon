"use client";
// Which safe-area edges the pane row insets itself for.
//
// The row takes `left` and `right` so no pane sits under a cutout or a
// system column. A shell that already places its navigation inside one of
// those columns (an Apple hardware edge column, for instance) says so through
// this context, so the row does not inset for the same column twice. Screens
// outside such a shell keep the default.
// SOT-KEYWORDS: adaptive panes safe area edges rail column iphone duo context
import { createContext, useContext } from "react";

export type PaneEdges = readonly ("left" | "right")[];

const BOTH: PaneEdges = ["left", "right"];

export const PaneEdgesContext = createContext<PaneEdges>(BOTH);

export function usePaneEdges(): PaneEdges {
  return useContext(PaneEdgesContext);
}
