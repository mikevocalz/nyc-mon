'use client';

import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { Section, View } from '../tw';
import type { LazySceneState } from './LazyScene';
import { useInView } from './use-in-view';

/** Props for {@linkcode SceneSection}. */
export interface SceneSectionProps {
  /**
   * The background, drawn behind the content. Forward `paused` to it and give
   * it `className="absolute inset-0"`.
   */
  scene: (state: LazySceneState) => ReactNode;
  /** The section's content, laid over the scene. Put text on a solid plate. */
  children: ReactNode;
  /**
   * Classes for the section. Give it a minimum height (`min-h-[520px]`): it
   * holds that space before the scene draws, so nothing shifts.
   */
  className?: string;
  /** Fill shown until the scene draws, as a CSS colour. Match the scene's sky. Default transparent. */
  placeholderColor?: string;
  /** How close to the viewport, in CSS pixels, the scene mounts. Default 600. */
  nearMarginPx?: number;
  /** DOM id for the section — anchors, aria-labelledby, motion targets. */
  id?: string;
}

/**
 * A page section with a canvas background behind its content: the hero of a
 * page, or a feature band. The content renders on the server like any other
 * section; the scene mounts on the client once the section is near the
 * viewport and pauses while it is scrolled away. One per page: it is the
 * page's strong background.
 *
 * @example
 * <SceneSection
 *   className="min-h-[520px]"
 *   placeholderColor={brand.night}
 *   scene={({ paused }) => <GridFloor skyline paused={paused} className="absolute inset-0" />}
 * >
 *   <SolidPanel tone="ink">…</SolidPanel>
 * </SceneSection>
 */
export function SceneSection({ scene, children, className, placeholderColor, nearMarginPx = 600, id }: SceneSectionProps) {
  const { ref, hasBeenNear, isVisible } = useInView({ nearMarginPx });
  return (
    <Section
      ref={ref}
      id={id}
      className={twMerge('relative w-full overflow-hidden', className)}
      // Computed: the placeholder is a caller colour, not a theme token.
      style={placeholderColor ? { backgroundColor: placeholderColor } : undefined}
    >
      {hasBeenNear ? scene({ paused: !isVisible }) : null}
      <View className="relative flex-1">{children}</View>
    </Section>
  );
}
